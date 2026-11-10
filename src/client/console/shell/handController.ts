/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE HAND CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {HandDockAlbum} from '@/client/components/console/consoleHandDockTypes';
import {handDockBayRem, shownHandCount} from '@/client/console/consoleHandDock';
import {blockersForReasons, potentiallyAvailable} from '@/common/availability/AvailabilityBlocker';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import {ConsoleHandEntry, HandTransitionTargets} from '@/client/components/console/consoleHandSectionTypes';
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {cardPayout, filterAlbumEntries, filterHandByTag, paysPresetOffered} from '@/client/components/console/consoleHandFilter';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {grantSeriesCountText, grantSeriesShown} from '@/client/console/parliament/grantSeries';
import {deckPickHolding} from '@/client/console/deckPick/consoleDeckPick';
import type {ConsoleHandStage} from '@/client/components/console/consoleHandSectionTypes';
import {WORKSPACE_FRAME_KINDS, workspaceHostYieldsScene, enterWorkspace, foldWorkspaceFrame, goBoardHome, leaveWorkspace, pushWorkspaceFrame, workspaceFrameDescended, workspaceFrameHasNested, workspaceFrameIndex, workspaceFramePhase, workspaceStackTop, workspaceFrameSubject, workspaceFrameStage, workspaceFrameHost, workspaceFrameKnown, workspaceFrameTarget, workspaceHostForStep, workspaceStackCrumb, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {colonyStepCrumbParts} from '@/client/console/colonyTrade/colonyTradeEntry';
import {beginDockIntakeAccent, dockIntakeAccentActive} from '@/client/console/handDock/consoleDockAccent';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {DockInspectionView, buildDockInspectionView, dockInspectionFor} from '@/client/console/handDock/dockInspection';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {finishInstant, holdHandBodiesForAlbum, isHandRevealEpisodeRunning, runHandCloseEpisode, runningHandRevealKind, settleHandHome, RevealPair} from '@/client/console/handDock/handRevealDirector';
import {draftPickBeatActive, riseSceneEngaged} from '@/client/console/cardDeal/consoleDraftTray';
import {Phase} from '@/common/Phase';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {forecastStageText} from '@/client/console/consoleEffectForecast';
import {availabilityContextFor} from '@/client/console/cardAvailability';
import {ZoomCard, bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {untakenNameMultiset} from '@/client/components/drawnCards/drawnCardsState';
import {revealKeptCardHeld} from '@/client/console/revealReading';
import {taskFor, DELEGATE_GRANT_STEP_STAGE} from '@/client/console/consoleTaskRouter';
import {leakDetectorState} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {cardExitBusy} from '@/client/console/cardDeal/cardExitDirector';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {planetFocusState} from '@/client/console/planetFocus';
import {deckDrawDealing, deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {consoleHandPickState, handPickStageKey} from '@/client/console/consoleHandPick';
import {consolePlayPickState} from '@/client/console/consolePlayPick';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {albumSpecFor} from '@/client/components/console/consoleHandAlbum';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {handPlayWindowClosed, offTurnReason} from '@/client/console/offTurnReason';
import {infoModeState} from '@/client/console/infoModeState';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import {PARLIAMENT_STEP_LEAVE_MS} from '@/client/console/shell/shellShared';
import type {SeatController} from '@/client/console/shell/seatController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {HandSelectController} from '@/client/console/shell/handSelectController';
import type {DraftController} from '@/client/console/shell/draftController';
import type {OutcomeController} from '@/client/console/shell/outcomeController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {RouterController} from '@/client/console/shell/routerController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {PlayCardController} from '@/client/console/shell/playCardController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {StartController} from '@/client/console/shell/startController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import type {WheelController} from '@/client/console/shell/wheelController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type HandPort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  actionBlockedReason: UnwrapRef<SeatController['actionBlockedReason']>,
  awaitingInput: UnwrapRef<SeatController['awaitingInput']>,
  colonyFocusOpen: UnwrapRef<ColonyController['colonyFocusOpen']>,
  colonyInspectModel: UnwrapRef<ColonyController['colonyInspectModel']>,
  consoleRevealMode: UnwrapRef<RevealController['consoleRevealMode']>,
  corpFirstActionOpen: UnwrapRef<PlayedController['corpFirstActionOpen']>,
  discardMeta: UnwrapRef<HandSelectController['discardMeta']>,
  dismissedRevealKey: UnwrapRef<RevealController['dismissedRevealKey']>,
  draftWorkspaceMounted: UnwrapRef<DraftController['draftWorkspaceMounted']>,
  executeRtEntry(id: string): void,
  externalDrawWorkspaceMounted: UnwrapRef<RevealController['externalDrawWorkspaceMounted']>,
  followUpStepStageKey: UnwrapRef<OutcomeController['followUpStepStageKey']>,
  game: UnwrapRef<SeatController['game']>,
  govSupportActive: UnwrapRef<ParliamentController['govSupportActive']>,
  handOutcomeLive: UnwrapRef<OutcomeController['handOutcomeLive']>,
  handPickActive: UnwrapRef<HandSelectController['handPickActive']>,
  handPickCoversSteps: UnwrapRef<HandSelectController['handPickCoversSteps']>,
  handPickHandNames: UnwrapRef<HandSelectController['handPickHandNames']>,
  handSelectExecuteSingle: UnwrapRef<HandSelectController['handSelectExecuteSingle']>,
  handSelectFiltered: UnwrapRef<HandSelectController['handSelectFiltered']>,
  handSelectPicked: UnwrapRef<HandSelectController['handSelectPicked']>,
  handSelectReasons: UnwrapRef<HandSelectController['handSelectReasons']>,
  handSelectSelectableNames: UnwrapRef<HandSelectController['handSelectSelectableNames']>,
  handSelectSingle: UnwrapRef<HandSelectController['handSelectSingle']>,
  handSelectSuitableOnly: UnwrapRef<HandSelectController['handSelectSuitableOnly']>,
  handSelectTaskActive: UnwrapRef<HandSelectController['handSelectTaskActive']>,
  handSelectUiActive: UnwrapRef<HandSelectController['handSelectUiActive']>,
  handSelectVerb: UnwrapRef<HandSelectController['handSelectVerb']>,
  hostTask: UnwrapRef<RouterController['hostTask']>,
  inspectedPlayer: UnwrapRef<SeatController['inspectedPlayer']>,
  journalPanelVisible: UnwrapRef<JournalController['journalPanelVisible']>,
  nativeCompositeTask: UnwrapRef<RouterController['nativeCompositeTask']>,
  openPlayCard: UnwrapRef<PlayCardController['openPlayCard']>,
  padSection: UnwrapRef<HandSelectController['padSection']>,
  parkWorkspaceStack(): void,
  parliamentLeaveRelease: UnwrapRef<ParliamentController['parliamentLeaveRelease']>,
  pendingPlayCard: UnwrapRef<PlayCardController['pendingPlayCard']>,
  pickBridgeActive: UnwrapRef<HandSelectController['pickBridgeActive']>,
  placementActive: UnwrapRef<PlacementController['placementActive']>,
  playAction: UnwrapRef<PlayCardController['playAction']>,
  playedTableVisible: UnwrapRef<PlayedController['playedTableVisible']>,
  readonly playerView: PlayerViewModel,
  postGame: UnwrapRef<SeatController['postGame']>,
  productionLossActive: UnwrapRef<RouterController['productionLossActive']>,
  releaseColoniesLeave: UnwrapRef<ColonyController['releaseColoniesLeave']>,
  restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean,
  revealVisualFor: UnwrapRef<RevealController['revealVisualFor']>,
  setupHandPending: UnwrapRef<StartController['setupHandPending']>,
  shellTask: UnwrapRef<RouterController['shellTask']>,
  startSceneServes: UnwrapRef<StartController['startSceneServes']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  toggleHandSelectPick: UnwrapRef<HandSelectController['toggleHandSelectPick']>,
  toggleSalePick: UnwrapRef<StdProjectsController['toggleSalePick']>,
  viewerPassed: UnwrapRef<SeatController['viewerPassed']>,
  wheelCounts: UnwrapRef<WheelController['wheelCounts']>,
  workspaceOutcomeEmbedded: UnwrapRef<OutcomeController['workspaceOutcomeEmbedded']>,
};

export function createHandController(shell: HandPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The hand is ending WITH a hosted step that was its whole screen — its one leave is a dissolve (`handLeaveHook`). */
  const handDissolveArmed = ref(false);
  /** A close/collapse gather is in its one-tick MEASURE window (accent
   *  armed, pose settling) — a second B may not race a second gather. */
  const handClosePreparing = ref(false);
  /** The pointer rests on the dock chassis — the bodies layer answers
   *  with the raised pose while the dock is interactive. */
  const dockHover = ref(false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const cardsPlayableCount = computed((): number => {
    return shell.wheelCounts.cards;
  });

  /** The hand total every HUD readout shows — the same intake-aware count
   *  the dock's «КАРТЫ» line uses (held / in-flight / untaken-reveal
   *  copies excluded), so no surface ever runs ahead of a physical take. */
  const cardsTotalCount = computed((): number => {
    return shownHandCount(handDockCards.value.map((c) => c.name as string), dockHeld.value);
  });

  // ── the permanent HAND DOCK (bottom-centre footer bay) ──────────────
  /** The dock's hand in SERVER order (append-stable — backs only, so the
   *  playable-first sort of the hand SECTION would just reshuffle the
   *  silhouettes on every playability change). SRR-hosted cards count:
   *  they are playable from the hand surface. */
  const handDockCards = computed((): ReadonlyArray<CardModel> => {
    return [
      ...shell.playerView.cardsInHand,
      ...(shell.thisPlayer.selfReplicatingRobotsCards ?? []),
    ];
  });

  /**
   * The bodies the single-owner layer actually renders.
   *
   * THE PACK LEAVES WITH THE DOCK. `handDockVisible` already hides the
   * chassis in the post-game — but the CARDS are not the dock's children,
   * they are one persistent fixed layer of their own (handBodies.ts), and
   * that layer paints at z 11645 while the scoring scene sits at 11480. So
   * the finale ran under a full hand of cards nobody could put away.
   *
   * Gated on the PHASE alone, deliberately: the pre-game setup window is the
   * dock's other hidden state, and cards are physically flying into it there
   * (the multiplayer research gap — see `setupHandPending`). «The game is
   * over» is the only moment there is no hand to own.
   */
  const handBodyCards = computed((): ReadonlyArray<CardModel> => {
    return shell.postGame ? [] : handDockCards.value;
  });

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
  const dockHeld = computed((): ReadonlyArray<string> => {
    const out: Array<string> = [...handDeliveryState.held, ...handDeliveryState.inFlight];
    untakenNameMultiset().forEach((k, name) => {
      for (let i = 0; i < k; i++) {
        out.push(name);
      }
    });
    // …and a KEPT REVEAL (TR13): the server put the card into the hand with
    // its verdict; it stands in the verdict's slot until «OK» hands it to
    // the intake (whose in-flight ledger takes over in the same block).
    const kept = revealKeptCardHeld(shell.playerView.lastReveal, shell.dismissedRevealKey);
    if (kept !== undefined) {
      out.push(kept);
    }
    return out;
  });

  /**
   * The PACK POSE the bodies layer renders (single-owner rework): raised
   * while the RT wheel offers «КАРТЫ» or the pointer rests on the live
   * dock (the «на готове» answer), compact when a busy screen asks the
   * pack to step back, rest otherwise. Pose CHANGES ride the layer's own
   * 340ms tween — and because the flight seizes the bodies wherever this
   * pose left them, the pose can never snap under the player's eyes.
   */
  const handPackPose = computed((): 'rest' | 'compact' | 'raised' | 'away' => {
    // THE INSPECTION HANDOVER: a FOREIGN seat's closed fan stands in the
    // tray (dockInspection), so the own pack is put away entirely — two
    // crowns in one holder would be two hands claiming one physical
    // object. Gated on the same predicate as the fan itself (the intake
    // accent included), so the two can never disagree about who owns the
    // tray; the wheel/hover raise is unreachable here by construction
    // (Info Mode owns the pad and `handDockInteractive` is false).
    if (dockInspection.value !== undefined) {
      return 'away';
    }
    if (consoleState.quick === 'actions' || (dockHover.value && handDockInteractive.value)) {
      return 'raised';
    }
    return handDockCompact.value ? 'compact' : 'rest';
  });

  /**
   * THE DOCK'S INSPECTION SEAT — while the Information Workspace inspects
   * ANOTHER participant, the dock softly becomes that seat's hand: a
   * read-only closed fan + the exact public count (a human's
   * `cardsInHandNbr`, the bot's `actionDeckSize` — the deck it plays from
   * and, empty, passes on). `undefined` = the ordinary own dock: the mode
   * is closed, the viewer inspects THEMSELVES, or the intake accent is
   * live (cards physically arriving to the OWN hand outrank the guest
   * presentation — the presence contract's one absolute).
   */
  const dockInspection = computed((): DockInspectionView | undefined => {
    if (!infoModeState.open || dockIntakeAccent.value) {
      return undefined;
    }
    const seat = dockInspectionFor(shell.thisPlayer.color, shell.inspectedPlayer, shell.playerView.game.automa);
    return seat === undefined ? undefined : buildDockInspectionView(seat, consoleLayoutState.profile);
  });

  /**
   * THE ALBUM IS NOT ON SCREEN — the workspace has DESCENDED into a stage, so
   * the browse layer (the shelf every hand card is laid out on) is parked
   * behind it: `.con-hand__browse--parked` is GONE, not dimmed.
   *
   * Derived from the very two props the section parks on (`stage`,
   * `stagePaused`), so the two can never disagree — a future change to what
   * unparks the shelf moves this predicate with it.
   */
  const handAlbumParked = computed((): boolean => {
    return handStage.value !== undefined && !shell.pickBridgeActive;
  });

  /**
   * The play composed in this workspace has PHYSICALLY LANDED — the card has
   * left the hand, flown, and settled on its pile. This is the point of no
   * return, and the hero's own phase is the only honest witness of it: a
   * refusal aborts long BEFORE it (`detectPlayedHero` commits only once the
   * server has put the card in the viewer's tableau), and the frame's phase
   * cannot answer — a plain play with no embeddable result stays `executing`
   * from the submit right through to the fold.
   */
  const handPlayLanded = computed((): boolean => {
    if (playedHeroState.host !== 'workspace') {
      return false;
    }
    const p = playedHeroState.phase;
    return p === 'committing' || p === 'showing-result' || p === 'returning' || p === 'closing';
  });

  /**
   * WHERE THE HAND'S CARDS LIVE RIGHT NOW — ONE fact, read by both returns.
   *
   * While the hand workspace stands they are EITHER on the album's shelf OR
   * in the dock, and the discriminator is whether the shelf is on screen…
   * plus the commit, because a DESCENT is reversible: B hands the card back
   * into its own slot, and sending the pack home at the descent would fill
   * the tray under a decision the player can still walk out of.
   *
   * So: parked shelf + a move that has physically happened = the cards are
   * home. It is a STATE, not an event, so both edges are covered by
   * construction — the rollback of a refused play and the discard that turns
   * the shelf back into the picker each simply flip it back.
   */
  const handCardsBelongToDock = computed((): boolean => {
    return consoleState.section === 'hand' && handAlbumParked.value && handPlayLanded.value;
  });

  /* (dockLiftedNames RETIRED by the single-owner bodies rework: the dock
     renders no card backs any more, so there is nothing to lift — the
     same persistent element is the docked back, the flight and the
     shelf/packet state. See handBodies.ts.) */
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
  const footerUnderScene = computed((): boolean => {
    // (The «Разыграно» table left this list with TR65: it is a workspace SCREEN in the central opening now — the
    // footer bar stays on top of it like on every workspace, and the dock stays the player's own hand.)
    return (
      botTurnReviewState.open ||
      leakDetectorState.stranded !== undefined
    );
  });

  /**
   * The centered decision surfaces: the footer BAR stays on top (their
   * command contract renders there), so the dock's card pack must not
   * poke over their veil — the dock parks (v-show) for their lifetime.
   * Flights into the dock only happen AFTER these surfaces close, so a
   * parked dock never robs a landing target.
   */
  const dockParkedUnderScene = computed((): boolean => {
    // A live CLIENT hand pick hides the composer / Action Center (v-show) —
    // the hand section IS the scene, so the dock unparks (the suitable-only
    // filter episode needs its rects, and the tray belongs to the hand view).
    if (shell.handPickActive) {
      return false;
    }
    return (
      shell.pendingPlayCard !== undefined ||
      shell.colonyFocusOpen ||
      shell.corpFirstActionOpen ||
      shell.govSupportActive ||
      shell.productionLossActive ||
      shell.nativeCompositeTask !== undefined ||
      shell.colonyInspectModel !== undefined ||
      consoleState.sheet !== undefined ||
      consoleState.confirm !== undefined ||
      infoModeState.open
    );
  });

  /** The OLD full под-сценой predicate — still what the HAND SECTION's
   *  verdict-bar z-drop keys off (`:underScene`). */
  const sceneOverHand = computed((): boolean => {
    return footerUnderScene.value || dockParkedUnderScene.value;
  });

  /** The colonies / hydro WORKSPACE sections own the bottom of the screen
   *  (colonies' focus-colony summary rail, hydro's CTA zone). The dock STAYS
   *  MOUNTED there (a Pluto card-draw trade animates INTO it), but drops
   *  BELOW the section content by z-index so its cards never poke over the
   *  rail. Board home keeps the dock on top as usual. */
  const dockBehindWorkspace = computed((): boolean => {
    // THE TUCK YIELDS TO THE INTAKE ACCENT — the whole dock comes up together. While cards are physically arriving
    // the fan's BODIES leave the tuck (`.con-handreveal-layer`, 11645 — the presence contract: full and on top), so
    // the footer must leave it too: a footer left at z:-1 put the plate, the «КАРТЫ» counter and the command bar
    // UNDER the rising fan, and the cards painted over the very dock they were landing in (the owner's Parliament
    // report — Tharsis Alliance's card; the same in the colonies' and the hydro's sections). The texture occludes
    // the bodies per pixel only from ABOVE them (`console_card_deal.less` § HAND REVEAL).
    if (dockIntakeAccent.value) {
      return false;
    }
    const phase = shell.playerView.game.phase;
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
    if (workspaceFrameHost('colonies') !== undefined || workspaceFrameHost('hydro') !== undefined || workspaceFrameHost('parliament') !== undefined) {
      return false;
    }
    // The bare colonies / hydro section grid. ⚠ ONLY the bare grid — while a
    // dimming OVERLAY is up (the trade / hydro confirm, inspect, a sheet…)
    // the footer MUST stay at its high z so the command bar reads BRIGHT
    // above the overlay's backdrop (dropping it left the bar dimmed under the
    // trade confirm — "не понятно какую кнопку нажать"). Those states are
    // exactly `dockParkedUnderScene` (where the dock is hidden anyway, so
    // nothing needs to tuck behind) + the hydro confirm.
    return (consoleState.section === 'colonies' || consoleState.section === 'hydro' || consoleState.section === 'parliament') &&
      !dockParkedUnderScene.value;
  });

  /** The dock (and the bar's centre bay) exists whenever a REAL hand can —
   *  everything but the endgame and the pre-game initial setup. */
  const handDockVisible = computed((): boolean => {
    return shell.game.phase !== 'end' && !shell.setupHandPending;
  });

  /**
   * CARDS ARE PHYSICALLY ARRIVING at (or leaving) the dock — the INTAKE
   * ACCENT. For its duration the dock stands in its FULL pose whatever is
   * open: the landing is the one moment the pack must be seen at size, and
   * every flight in these episodes measures the dock's rects — a pose
   * change mid-episode would move the targets out from under the proxies.
   */
  const dockIntakeAccent = computed((): boolean => {
    // A BOUNDED LEASE, never a read of foreign flags (consoleDockAccent.ts).
    // The first cut ORed four booleans owned by four different directors —
    // and any one of them sticking disabled the compact pose for the REST OF
    // THE GAME. One of them did exactly that.
    return dockIntakeAccentActive();
  });

  /**
   * THE COMPACT POSE — the dock's answer to a busy screen (the presence
   * contract above): it never hides and never re-layers below a surface;
   * where a status rail / a workspace band / a sheet / an embedded step
   * would collide with the pack, the pack steps back into the tray instead.
   * `!handDockInteractive` is exactly «something owns the screen» — the one
   * predicate that already enumerates every such surface — plus Planet
   * Focus, which is a board-home state that makes the BOARD the subject.
   */
  const handDockCompact = computed((): boolean => {
    if (dockIntakeAccent.value) {
      return false;
    }
    return planetFocusState.phase !== 'idle' || !handDockInteractive.value;
  });

  const handDockInteractive = computed((): boolean => {
    if (consoleState.section !== 'board' || consoleState.fallbackActive || shell.game.phase === 'end') {
      return false;
    }
    return !(
      shell.hostTask !== undefined ||
      // The draft workspace: the dock stays VISIBLE in its compact pose for
      // the whole flow (the intake accent lease brings it to FULL exactly
      // while the purchase flights land).
      shell.draftWorkspaceMounted ||
      // The external-draw workspace: same card-flow contract — the dock
      // stays visible (the takes land in it), compact until the intake
      // accent lease brings it full.
      shell.externalDrawWorkspaceMounted ||
      shell.startSceneServes ||
      shell.govSupportActive ||
      shell.productionLossActive ||
      shell.nativeCompositeTask !== undefined ||
      shell.consoleRevealMode !== undefined ||
      consoleState.sheet !== undefined ||
      consoleState.confirm !== undefined ||
      shell.pendingPlayCard !== undefined ||
      shell.colonyFocusOpen ||
      shell.colonyInspectModel !== undefined ||
      shell.corpFirstActionOpen ||
      shell.playedTableVisible ||
      shell.journalPanelVisible ||
      infoModeState.open ||
      botTurnReviewState.open ||
      govScaleFocusState.holding || govScaleFocusState.closing ||
      draftPickBeatActive() || riseSceneEngaged() ||
      leakDetectorState.stranded !== undefined
    );
  });

  /** The bay width flows from ONE source (consoleHandDock.ts) into both
   *  consumers: the bar's grid track and the dock's plate. */
  const footerVars = computed((): Record<string, string> => {
    return {'--con-hd-bay': `${handDockBayRem(consoleLayoutState.profile)}rem`};
  });

  /** Some host is handing its whole scene to a nested workspace right now.
   *  ⚠ Only hosts whose hide RIDES THE DIRECTOR'S HOOKS belong here. The
   *  START scene hides through its own `yielded` paint gate (no transition
   *  fires for it), and counting it would flip `pickBridgeActive` on for
   *  the guest's whole mount — the director's enter hook resolves instantly
   *  under that flag, so the awards step would POP IN instead of playing
   *  its entrance. */
  const sceneHandedOver = computed((): boolean => {
    // …EXCEPT the Parliament (Turmoil Redux): it yields its scene to the
    // ACTION WORKSPACE, and hides ITSELF by class (`.con-parl--handed-over`,
    // a crossfade — never a `v-show` the director could mistake for a
    // leave). Counting it here flipped the bridge fact ON for the very
    // surface it handed the scene TO: `ConsoleCardActions`' own v-show read
    // «a bridge is out» and blanked the composer the player had just
    // opened («ПАРЛАМЕНТ › УЧЁНЫЕ › НАСТРОЙКА» over an empty band).
    return WORKSPACE_FRAME_KINDS.some((kind) => kind !== 'start' && kind !== 'parliament' && workspaceHostYieldsScene(kind));
  });

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
  const cardArrivalBusy = computed((): boolean => {
    return deckDrawHolds() ||
      isBoardCardBonusActive() ||
      handDeliveryState.flights.length > 0;
  });

  /**
   * THE PREVIOUS CARD STAGE IS STILL LEAVING — the join every «may the next
   * batch take the scene?» question reads. Terms are COMPLETION-shaped
   * module facts, each ending on its own real finish:
   *  · the deck pick's commit hold (picks flying + the rejected dissolve —
   *    `clearRest` now awaits the LAST card's animationend);
   *  · the hand-intake delivery flights (the taken cards' physical trip);
   *  · the standalone discard dissolves (`cardExitBusy` — applyDiscardExit
   *    counts its own runs to their joined end).
   * One list, read by the claimed barrier above AND the unclaimed guard in
   * `consoleRevealMode` — a batch nobody claimed must not overlap either.
   */
  const cardStageExitBusy = computed((): boolean => {
    return deckPickHolding() ||
      handDeliveryState.flights.length > 0 ||
      isHandDeliveryActive() ||
      cardExitBusy();
  });

  // ── hand ────────────────────────────────────────────────────────────
  // The WHOLE hand (playable-first), before the tag filter. Drives the
  // filter panel's option counts + the "All" total.
  const handEntriesAll = computed((): Array<ConsoleHandEntry> => {
    // EXECUTABLE NOW — the server's live play offer. It gates the press and
    // nothing else; off-turn it is empty by construction.
    const playable = new Set((shell.playAction?.input.cards ?? [])
      .filter((c) => c.isDisabled !== true)
      .map((c) => c.name));
    const robots = new Set((shell.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name));
    // A LAW'S PLAY PICK (RX36): every card is read as the LAW reads it — the promised pick's own model (the
    // requirement under the law's waiver, «благодаря закону»; a card the law does not open refused with its reason,
    // the bill's reserve named) — and «could I» is «could I through the law, now» (nothing else is being asked).
    const lawPick = consolePlayPickState.active ? consolePlayPickState.request : undefined;
    const promised = new Map((lawPick?.input.cards ?? []).map((c) => [c.name, c]));
    const all: Array<CardModel> = [
      ...shell.playerView.cardsInHand,
      ...(shell.thisPlayer.selfReplicatingRobotsCards ?? []),
    ].map((card) => promised.get(card.name) ?? card);
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
        (lawPick === undefined && potentiallyAvailable(blockersForReasons(card.unplayableReasons ?? []))),
      robot: robots.has(card.name),
    }));
    // Playable-first, stable within groups (CONSOLE_MODE_CONCEPT §8) — by
    // POTENTIAL, so the shelf keeps its reading order when the turn passes
    // (on the viewer's own turn the two sets coincide).
    return [
      ...entries.filter((e) => e.potential),
      ...entries.filter((e) => !e.potential),
    ];
  });

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
  const handStage = computed((): ConsoleHandStage | undefined => {
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
    const outcomeStage = shell.handOutcomeLive &&
      (shell.workspaceOutcomeEmbedded || deckDrawDealing() || outcomeNamed) ?
      (outcomeNamed ? workspaceOutcomeState.phaseKey : focusKicker('draw')) :
      shell.followUpStepStageKey;
    // …and once that owed step actually STANDS, the tail is the DEEPEST
    // frame's, not ours. It used to stop at the hand, so the moment the colony
    // grid opened inside this workspace the line read «КАРТЫ В РУКЕ › НАУЧНАЯ
    // КОЛОНИЯ › РОЗЫГРЫШ» — naming a stage the player had just left, one
    // screen up. The step publishes its own name UP the stack
    // (`setWorkspaceFrameStage`), so this is a READ of the one source, never a
    // second one; it outranks the terms below because depth outranks phase.
    // …except where a hand pick COVERS those steps (`handPickCoversSteps`): the album is the surface on top, so the
    // tail is the PICK's — «СБРОС КАРТЫ» over Mars University's discard — never the hidden colony step's
    // «МИРАНДА · ОСМОТР» (the field lock of 2026-10-14 named the colony over the discard album).
    const pickStage = shell.handPickCoversSteps ? handPickStageKey(consoleHandPickState.request) : '';
    const nestedStage = pickStage !== '' ? pickStage : workspaceFrameHasNested('hand') ?
      (workspaceStackCrumb()?.stage ?? '') : '';
    const stage = nestedStage !== '' ? nestedStage :
      (outcomeStage !== '' ? outcomeStage : workspaceFrameStage('hand'));
    const name = stage === '' ? 'Playing' : stage;
    // The play composer's R3 «Эффекты» LAYER is a level INSIDE the stage —
    // the tail gains «· ЭФФЕКТЫ» (and the source card's name at its detail)
    // and gives it back on B / R3; the composed string is pre-translated.
    const forecastTail = nestedStage === '' && outcomeStage === '' ? forecastStageText('play', name) : undefined;
    // A HOSTED COLONY STEP folds the colony it carries INTO the tail — «КАРТЫ В РУКЕ › СПОНСОРЫ КОЛОНИЙ › ЛУНА ·
    // ТРЕК» — the grammar «Действия карт» speaks for the same step (`colonyStepCrumbParts`): the subject slot is
    // already the card's. Before a colony is picked up there is only the stage.
    const colonyTail = pickStage === '' && workspaceFrameHost('colonies') === 'hand' && workspaceFrameSubject('colonies') !== '' ?
      colonyStepCrumbParts(workspaceFrameSubject('colonies'), workspaceFrameStage('colonies')).map((part) => translateText(part)).join(' · ') :
      undefined;
    // A SERIES OF GRANTS (P70 Colonial Envoys — `grantSeries.ts`): the vote step's tail COUNTS its decision —
    // «ГОЛОСОВАНИЕ · 2 / 3» — the decision on its way while its cube flies, the standing one once the mode is back in
    // its selection (only the count changes: one segment's crossfade, like any stage).
    // Keyed on the STAGE being the vote (whichever path named it — the owed step before the frame, the frame after):
    // a later stage of the same step («ЭФФЕКТ ПАРТИИ») is not a decision and counts nothing.
    const series = pickStage === '' && name === DELEGATE_GRANT_STEP_STAGE ?
      grantSeriesShown(parliamentFlow.voteSnapshot?.series, shell.playerView.waitingFor) : undefined;
    const seriesTail = series === undefined ? undefined : `${translateText(name)} · ${grantSeriesCountText(series)}`;
    return {
      subject: workspaceFrameSubject('hand'),
      name: colonyTail ?? seriesTail ?? forecastTail ?? name,
      committed: isCommitted(phase),
      raw: colonyTail !== undefined || seriesTail !== undefined || forecastTail !== undefined,
    };
  });

  /**
   * The zone the HAND is teleported into — published by the frame BELOW it
   * (the start workspace hosting a play-from-hand prelude). `undefined` at
   * depth 0 (it stands in its own band) and while the host's zone is not up
   * yet — ownership ≠ readiness, embed rule 4.
   */
  const handEmbedTarget = computed((): string | undefined => {
    return workspaceFrameTarget('hand');
  });

  /**
   * THE ALBUM'S ENTRIES — the mode's own set (`handModeEntries`), narrowed in a PICKER (select / sale / a composer's
   * pick) by the picker's OWN chip (`selectTagFilter` — P50's polish companion · ledger FD): the browse tag is never
   * read there, so a tag left on in the hand never hides a candidate of a mandatory discard.
   */
  const handEntries = computed((): ReadonlyArray<ConsoleHandEntry> => {
    const mode = handModeEntries.value;
    return handAlbumPicker.value ? filterAlbumEntries(mode, consoleState.selectTagFilter, shell.discardMeta?.exchange) : mode;
  });

  /** A PICKER owns the album (the sale, a mandatory select, a composer's pick) — its chips are its own. */
  const handAlbumPicker = computed((): boolean => {
    return consoleState.sale.active || shell.handSelectUiActive;
  });

  /** The picker's session — a new prompt, a new pick or the sale's entry starts the chips at «ВСЕ». */
  const handAlbumPickerKey = computed((): string => {
    if (!handAlbumPicker.value) {
      return '';
    }
    return [consoleState.sale.active ? 'sale' : '', shell.handPickActive ? 'pick' : '', shell.handSelectTaskActive ? 'task' : '',
      String(shell.playerView.waitingFor?.promptId ?? '')].join('|');
  });

  /**
   * What each card pays if thrown — a PER-TAG exchange only (the Reds' recycle, FD): the plate under the card and the
   * «ПЛАТЯТ» chip read the same number (`cardPayout` — the header's rule, card by card). Empty otherwise.
   */
  const handCardPayouts = computed((): Readonly<Record<string, number>> => {
    const exchange = shell.discardMeta?.exchange;
    if (!handAlbumPicker.value || !paysPresetOffered(exchange)) {
      return {};
    }
    return Object.fromEntries(handModeEntries.value.map((e) => [e.card.name, cardPayout(e.card, exchange)]));
  });

  /** The mode's own entries, before a picker's chip (the browse hand applies its tag here). */
  const handModeEntries = computed((): ReadonlyArray<ConsoleHandEntry> => {
    if (consoleState.sale.active) {
      return handEntriesAll.value;
    }
    // CLIENT composer pick: same narrowing as the server select, over the
    // pick's shown-hand universe (no staged card, no SRR-hosted cards).
    if (shell.handPickActive) {
      // The card being played is NOT among them (`handPickHandNames` leaves the staged card out): the rules never
      // offer it — «reveal any number of OTHER cards» — so the album does not show it (2026-10-14).
      const shown = new Set(shell.handPickHandNames);
      const base = handEntriesAll.value.filter((e) => shown.has(e.card.name));
      if (shell.handSelectSuitableOnly && shell.handSelectFiltered) {
        const sel = new Set(shell.handSelectSelectableNames);
        return base.filter((e) => sel.has(e.card.name));
      }
      return base;
    }
    // MANDATORY hand SELECT (discard / reveal / place): the tag filter is
    // replaced by the "suitable only" filter. When on (default) a NARROWED
    // (conditional) prompt shows only the candidate cards; toggling it off
    // reveals the whole hand for context (non-candidates stay non-pickable).
    if (shell.handSelectTaskActive) {
      if (consoleState.select.suitableOnly && shell.handSelectFiltered) {
        const sel = new Set(shell.handSelectSelectableNames);
        return handEntriesAll.value.filter((e) => sel.has(e.card.name));
      }
      return handEntriesAll.value;
    }
    return filterHandByTag(handEntriesAll.value, consoleState.handTagFilter);
  });

  /**
   * THE ALBUM UNIVERSE — every card PHYSICALLY IN THE ALBUM while the hand
   * is open: mode-narrowed (a client pick's shown hand excludes the staged
   * card + SRR-hosted cards) but NEVER view-filtered. The tag filter and
   * «only suitable» decide which PAGE a card is on — or that it parks with
   * the far page packets — never whether it left the dock. The dock's lift
   * and the open/close flights read THIS, which is what makes the dock
   * genuinely empty for the whole open hand.
   */
  const handAlbumUniverse = computed((): ReadonlyArray<ConsoleHandEntry> => {
    if (shell.handPickActive) {
      const shown = new Set(shell.handPickHandNames);
      return handEntriesAll.value.filter((e) => shown.has(e.card.name));
    }
    return handEntriesAll.value;
  });

  /** Universe cards OUTSIDE the current view (tag / suitable filter) —
   *  parked with the far-side page packets by the section's transition
   *  geometry, so the reveal flies them out of the dock and the close
   *  gathers them home with everything else. */
  const handPacketExtras = computed((): ReadonlyArray<string> => {
    const visible = new Set(handEntries.value.map((e) => e.card.name));
    const out: Array<string> = [];
    for (const e of handAlbumUniverse.value) {
      if (!visible.has(e.card.name)) {
        out.push(e.card.name);
      }
    }
    return out;
  });

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
  const handDockAlbum = computed((): HandDockAlbum | undefined => {
    if (shell.padSection !== 'hand') {
      return undefined;
    }
    if (workspaceFrameDescended('hand') && !shell.handPickActive) {
      return undefined;
    }
    const count = handEntries.value.length;
    const spec = albumSpecFor(consoleLayoutState.profile, albumLayoutState.layout);
    const perPage = spec.cols * spec.rows;
    const pages = Math.max(1, Math.ceil(count / perPage));
    const idx = Math.min(Math.max(0, count - 1), Math.max(0, consoleState.handIndex));
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
  });

  /** A hand-served shell task (play-from-hand OR mandatory hand-select) — the
   *  hand section is the surface, so the right stick may scroll the grid. */
  const handShellServed = computed((): boolean => {
    const t = shell.shellTask;
    return t?.kind === 'handSelect' ||
      (t?.kind === 'projectCard' && t.mode === 'playFromHand');
  });

  /** The turn/phase reason (i18n key) shown for a hand card that is rules-OK
   *  but not playable in this window — the honest alternative to a bare block
   *  when the server has no rules-reason (opponent's turn / mid-placement). */
  const handSoftReason = computed((): string => {
    // On the viewer's OWN turn a card that isn't playable now is blocked by a
    // pending decision (a mandatory corp/forced prompt, a placement, a mid-sub
    // action) — «Сначала завершите текущее действие», NOT «Сейчас не ваш ход»
    // (which is only true when it is genuinely an opponent's turn).
    // A seat that PASSED is told so (class CT) — the shared ladder, never a copy of its strings.
    return shell.actionBlockedReason !== '' ? 'Finish your current action first' : offTurnReason(shell.awaitingInput, shell.viewerPassed);
  });

  /** The play WINDOW is closed — a decision is already owed, or no play
   *  is offered away from the action menu (`handPlayWindowClosed`). THE
   *  discriminator for whether the turn note joins a card's availability
   *  view (hand verdict bar + fullscreen panel read the same flag, so their
   *  reason lists match row for row). */
  const handTurnWindowClosed = computed((): boolean => {
    return handPlayWindowClosed({
      playOffered: shell.playAction !== undefined,
      atActionMenu: taskFor(shell.playerView)?.kind === 'actionMenu',
      actionBlocked: shell.actionBlockedReason !== '',
    });
  });

  /** True when the hand grid is the surface the right stick should scroll —
   *  in the hand section with nothing layered on top (a play-confirm / task /
   *  reveal / fullscreen zoom would otherwise get scrolled through blindly). */
  const handScrollActive = computed((): boolean => {
    return shell.padSection === 'hand' &&
      !isHandRevealEpisodeRunning() && // flight targets pin the layout
      // A hidden play composer under a live client hand pick doesn't block —
      // the hand grid IS the active surface for the pick's lifetime.
      (shell.pendingPlayCard === undefined || shell.handPickActive) &&
      shell.hostTask === undefined &&
      // A hand-served shell task (play-from-hand / mandatory hand-select)
      // keeps the grid scrollable; any OTHER shell task means the hand is
      // not the focus surface.
      (shell.shellTask === undefined || handShellServed.value) &&
      !shell.startSceneServes &&
      shell.consoleRevealMode === undefined;
  });

  /** The played project card(s) shown this turn — X = Осмотреть карту. */
  const reviewCardNames = computed((): ReadonlyArray<CardName> => {
    return botTurnReviewState.review?.cardNames ?? [];
  });

  const reviewInspectable = computed((): boolean => {
    return botTurnReviewState.open && reviewCardNames.value.length > 0;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * COLLAPSE WITH THE HAND'S GATHER: measure the live grid while it still
   * stands, start the standard close episode, and only then park — the
   * proxies fly over the board (the park is this path's `setSection`, one
   * tick before the episode's own hook fires against an already-empty live
   * stack, where it is a no-op). The section watcher can't reset the
   * presentation mid-flight: the episode registers synchronously.
   */
  async function collapseWithHandGather(): Promise<void> {
    if (handClosePreparing.value) {
      return;
    }
    // Same landing-pose discipline as `closeHandWithReveal`: the accent
    // FIRST, the targets from `landingRects` — a collapse measured in the
    // compact pose landed the pack in miniature too.
    handClosePreparing.value = true;
    const releaseAccent = beginDockIntakeAccent('hand-close');
    try {
      await shell.$nextTick();
      const section = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
      const t: HandTransitionTargets = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      // Landing targets are analytic (the bodies layer's pose oracle).
      const pairs: Array<RevealPair> = t.pairs.map((p) => ({
        name: p.name, target: p.rect, visible: p.visible, clip: p.clip, visual: shell.revealVisualFor(p.name),
      }));
      if (pairs.length === 0) {
        // Nothing measurable — the honest instant park (never a zero-pair
        // episode, whose empty-input path would pop the hand frame BEFORE
        // the park and lose the step's depth).
        shell.parkWorkspaceStack();
        return;
      }
      const episode = runHandCloseEpisode(pairs, t.scrollTop, t.stage);
      shell.parkWorkspaceStack();
      await episode;
    } finally {
      handClosePreparing.value = false;
      releaseAccent();
    }
  }

  /**
   * Stand the HAND up: a screen of its own, or a STEP inside whatever flow is
   * already open (the start's play-from-hand prelude — «Эпатажный спонсор»).
   * `overlay` is the client PICK BRIDGE: the hand takes the screen while the
   * asking composer waits underneath with its captures intact.
   */
  function openHandWorkspace(opts?: {overlay?: boolean}): void {
    if (shell.restoreParkedWorkspace('hand') || workspaceFrameIndex('hand') !== -1) {
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
  }

  /**
   * THE HAND'S EXIT once it has answered. An OVERLAY hand pops, uncovering
   * the flow that asked for the card exactly where it was left; a hand the
   * player is standing in alone has nothing under it and goes home.
   */
  function leaveHandAfterAnswer(): void {
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
    const verb = handExitVerb();
    if (verb === 'none') {
      return;
    }
    if (verb === 'pop') {
      leaveWorkspace();
      return;
    }
    closeConsoleLayers();
    goBoardHome();
  }

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
  function handExitVerb(): 'none' | 'pop' | 'home' {
    if (workspaceFrameIndex('hand') === -1) {
      return 'none';
    }
    if (workspaceFrameHost('hand') !== undefined) {
      return 'pop';
    }
    // A flow ends through its ONE guarded conclusion, never through an answer
    // given inside it: while this workspace still holds the claim of the play
    // made in it, everything that play set off is still coming HERE.
    return shell.handOutcomeLive ? 'none' : 'home';
  }

  /** The card-play descent is over — the hand's frame folds back to its
   *  parked browse grid (selection, filter and scroll intact). */
  function foldHandStage(): void {
    if (workspaceFrameDescended('hand') && !workspaceFrameHasNested('hand')) {
      foldWorkspaceFrame();
    }
  }

  /** The hand dock (footer bay) clicked — the mouse/touch entry point to
   *  the hand. Same path as RT → КАРТЫ; guarded to the calm board home
   *  (the dock is `live` there — every overlay state is non-interactive). */
  function onHandDockOpen(): void {
    if (consoleState.section !== 'board' || shell.placementActive ||
        consoleState.quick !== undefined || consoleState.confirm !== undefined) {
      return;
    }
    shell.executeRtEntry('cards');
  }

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
  function handExitSlot(name: CardName): HTMLElement | null {
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
    return document.querySelector<HTMLElement>(`.con-hand [data-zoom-slot="${esc}"]`);
  }

  /**
   * THE HAND'S ONE LEAVE HOOK. Every ordinary ending of the hand releases at
   * once (the hook exists for one case and must change nothing else — a
   * `v-show` flip calls it too). Armed by `endHandWithHostedStep`, the section
   * is FROZEN at its live rect (fixed, inert — it shares `.con-main`'s row
   * with the returning board and must not squeeze it) and dissolves over the
   * planet, carrying the hosted Parliament inside it; the step's own release
   * fires when this motion ends.
   */
  function handLeaveHook(el: Element, done: () => void): void {
    const armed = handDissolveArmed.value;
    handDissolveArmed.value = false;
    const finish = (): void => {
      done();
      shell.parliamentLeaveRelease?.();
      shell.releaseColoniesLeave();
    };
    if (!armed || !(el instanceof HTMLElement) || consoleReducedMotionActive() || typeof el.animate !== 'function') {
      finish();
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(el.style, {
      position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
      margin: '0', zIndex: '5', pointerEvents: 'none',
    });
    el.animate([{opacity: 1}, {opacity: 0}], {duration: motionMs(PARLIAMENT_STEP_LEAVE_MS), easing: 'ease-out', fill: 'forwards'})
      .finished.then(finish, finish);
  }

  /**
   * X on the review — inspect the played card. A BONUS turn opens the
   * full-rules bonus-card inspect; a PROJECT turn opens the fullscreen browser
   * over the project cards the turn played (newest on screen).
   */
  function inspectReviewCard(): boolean {
    const review = botTurnReviewState.review;
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
    const projects: Array<ZoomCard> = reviewCardNames.value.map((name) => ({name} as CardModel));
    const entries = [...projects, ...service];
    if (entries.length === 0) {
      return false;
    }
    openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn', origin: {kind: 'textual'}});
    return true;
  }

  /** PHYSICAL zoom origin for the hand grid: the fullscreen card lifts out
   *  of the `data-zoom-slot` tile; browsing LB/RB moves `handIndex`, whose
   *  section watcher scrolls the slot into view — so the close flight
   *  always has a live slot to land in (a still-virtualized slot falls
   *  back to the inspector dive gracefully). */
  function handZoomOrigin() {
    const names = handEntries.value.map((e) => e.card.name);
    return slotZoomOrigin(
      () => document.querySelector<HTMLElement>('.con-hand'),
      (i) => names[i] ?? '',
      (i) => {
        consoleState.handIndex = i;
      },
    );
  }

  /** X in the hand section: read the focused card fullscreen. In SALE
   *  mode the viewer's A toggles the pick (a pure selection flip — the
   *  sale submit stays on the section's Y). In PLAY mode (P17 desktop
   *  parity) the viewer's A plays a PLAYABLE card through the existing
   *  play-confirm flow, and an unplayable card shows its structured
   *  «why not» reasons instead — never a mute fullscreen. */
  function zoomHandCard(): void {
    if (handEntries.value.length === 0) {
      return;
    }
    // X mid-filter-glide: snap the episode first — the zoom flight measures
    // the slot rect, which is held-invisible under a flying proxy.
    if (runningHandRevealKind() === 'filter') {
      finishInstant();
    }
    const origin = handZoomOrigin();
    if (consoleState.sale.active) {
      // The SALE is a decision about an unplayed own card, so the viewer
      // speaks availability in the requirement voice ('hand-sell' → draft):
      // «what can I still play?» is exactly what prices a patent. The sale's
      // own selection state stays the authoritative layer — availability
      // never gates the pick.
      openConsoleCardZoom(handEntries.value.map((e) => e.card), consoleState.handIndex, {
        isSelected: (name: CardName) => consoleState.sale.selected.includes(name),
        toggle: (name: CardName) => shell.toggleSalePick(name),
      }, undefined, {origin, availability: availabilityContextFor('hand-sell')});
      return;
    }
    // Hand SELECT (server task OR client composer pick): fullscreen A
    // answers the single-pick / toggles a multi-pick; a non-candidate card
    // surfaces its «why not» reason (single) or is inert (multi — the reason
    // is on the grid card / verdict bar).
    if (shell.handSelectUiActive) {
      const verb = shell.handSelectVerb;
      const selectable = (name: CardName) => shell.handSelectSelectableNames.includes(name);
      // Giving a hand card up (discard / reveal / place-under) is the same
      // future-value question as the sale ('hand-give' → draft voice): the
      // player deserves to see which card they can still hope to play before
      // parting with one. The prompt's own candidacy (`reasonsFor` /
      // `selectable`) stays a separate, authoritative layer.
      const giveAvailability = availabilityContextFor('hand-give');
      if (shell.handSelectSingle) {
        openConsoleCardZoom(handEntries.value.map((e) => e.card), consoleState.handIndex, undefined, {
          labelFor: (name: CardName) => (selectable(name) ? verb : undefined),
          reasonsFor: (name: CardName) => {
            const r = shell.handSelectReasons[name];
            return !selectable(name) && r !== undefined && r !== '' ? [r] : [];
          },
          execute: (name: CardName) => shell.handSelectExecuteSingle(name),
        }, {origin, availability: giveAvailability});
      } else {
        openConsoleCardZoom(handEntries.value.map((e) => e.card), consoleState.handIndex, {
          isSelected: (name: CardName) => shell.handSelectPicked.includes(name),
          toggle: (name: CardName) => {
            if (selectable(name)) {
              shell.toggleHandSelectPick(name);
            }
          },
        }, undefined, {origin, availability: giveAvailability});
      }
      return;
    }
    openConsoleCardZoom(handEntries.value.map((e) => e.card), consoleState.handIndex, undefined, {
      labelFor: (name: CardName) => {
        const entry = handEntries.value.find((e) => e.card.name === name);
        return entry?.playable === true ? 'Play now' : undefined;
      },
      reasonsFor: (name: CardName) => handUnplayableReasons(name),
      execute: (name: CardName) => shell.openPlayCard(name),
      // «Разыграть» opens the play-confirm composer, which shows THIS card
      // — the fullscreen card flies INTO its slot there, not back to the hand.
      handoffTarget: () => '.con-composer--play [data-zoom-handoff="play-card"]',
    }, {origin, availability: availabilityContextFor('hand-play')});
  }

  /** Translated «why not» lines for a hand card (mirrors the hand
   *  section's info panel — same server-structured reasons, same shared
   *  formatter so the unit-suffixed "Сейчас: …" reads identically). */
  function handUnplayableReasons(name: CardName): ReadonlyArray<string> {
    const entry = handEntries.value.find((e) => e.card.name === name);
    const reasons = entry?.card.unplayableReasons ?? [];
    return reasons.slice(0, 3).map((r) => unplayableReasonLine(r));
  }

  /** "Нельзя разыграть: <первая причина>" — the global fix so pressing A on
   *  an unplayable card never shows a bare block (the fork's always-explain
   *  rule). Pre-translated (showNotice's $t is a no-op on unknown strings),
   *  with an honest generic fallback when no structured reason surfaced. */
  function handBlockedNotice(entry: ConsoleHandEntry): string {
    const first = (entry.card.unplayableReasons ?? [])[0];
    // No server RULES reason → the card is fine, it's just not the player's
    // window (opponent's turn / mid-placement) — name that honestly rather
    // than a misleading "conditions not met".
    if (first === undefined) {
      return translateText(handSoftReason.value);
    }
    return translateTextWithParams('Cannot play: ${0}', [unplayableReasonLine(first)]);
  }

  /**
   * LB/RB — the ALBUM PAGE TURN, one verb for every hand mode (browse,
   * sale, select, pick, embedded): the section owns the motion (a
   * retargetable transform slide — rapid presses redirect, never queue)
   * and the page derives from the focus index, so selection and picks
   * survive by construction. The first/last page swallows the press.
   */
  function turnHandPage(dir: 1 | -1): void {
    const hand = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
    hand?.turnPage(dir);
  }

  /** The bay spine's own LB/RB chips clicked (mouse door). */
  function onDockPage(dir: 1 | -1): void {
    turnHandPage(dir);
  }


  // ── the bodies of the watchers (the `watch` block is their ordered table) ──────────────────────────────
  /** A PICKER's chips start at «ВСЕ» on entry and on every new question (FD) — never a leftover narrowing. */
  function whenHandAlbumPickerKeyChanges(): void {
    consoleState.selectTagFilter = 'all';
    consoleState.filterFocus = -1;
  }

  /**
   * THE HAND GOES HOME BEHIND THE SCENE — the play's own quiet closing move.
   *
   * The premium GATHER (grid → dock) is a flight from where the player last
   * saw the cards, so it belongs to the endings the player asks for: B out of
   * the album, «свернуть» from it. A PLAY does not end there — its descent
   * parked the shelf the moment the composer opened, and the cards have not
   * been on screen since. Left to the fold, the pack's bodies then came back
   * as a flight measured off that invisible grid: they materialized over the
   * board a beat AFTER the workspace had already dissolved and darted into
   * the tray from nowhere.
   *
   * So the pack comes home the instant the card physically lands on its pile
   * — under the landing scene, a beat before the workspace folds, with no
   * travel at all (`settleHandHome`). By the time the fold happens the dock
   * is already at rest: the ending moves nothing.
   *
   * The falling edge is the same law read backwards: the shelf is the cards'
   * home again (a refused play rolled back to `configure`, or the discard
   * this play forced turned the shelf into the picker), so the bodies hide
   * back under its slots. Guarded on the section, because the ordinary way
   * this goes false is the workspace LEAVING — and there the pack is exactly
   * where it belongs.
   */
  function whenHandCardsBelongToDockChanges(now: boolean, was: boolean): void {
    if (now) {
      settleHandHome();
    } else if (was && consoleState.section === 'hand') {
      holdHandBodiesForAlbum();
    }
  }

  return {
    handDissolveArmed,
    handClosePreparing,
    dockHover,
    cardsPlayableCount,
    cardsTotalCount,
    handDockCards,
    handBodyCards,
    dockHeld,
    handPackPose,
    dockInspection,
    handAlbumParked,
    handPlayLanded,
    handCardsBelongToDock,
    footerUnderScene,
    dockParkedUnderScene,
    sceneOverHand,
    dockBehindWorkspace,
    handDockVisible,
    dockIntakeAccent,
    handDockCompact,
    handDockInteractive,
    footerVars,
    sceneHandedOver,
    cardArrivalBusy,
    cardStageExitBusy,
    handEntriesAll,
    handStage,
    handEmbedTarget,
    handEntries,
    handAlbumPicker,
    handAlbumPickerKey,
    handCardPayouts,
    handModeEntries,
    handAlbumUniverse,
    handPacketExtras,
    handDockAlbum,
    handShellServed,
    handSoftReason,
    handTurnWindowClosed,
    handScrollActive,
    reviewCardNames,
    reviewInspectable,
    collapseWithHandGather,
    openHandWorkspace,
    leaveHandAfterAnswer,
    handExitVerb,
    foldHandStage,
    onHandDockOpen,
    handExitSlot,
    handLeaveHook,
    inspectReviewCard,
    handZoomOrigin,
    zoomHandCard,
    handUnplayableReasons,
    handBlockedNotice,
    turnHandPage,
    onDockPage,
    whenHandAlbumPickerKeyChanges,
    whenHandCardsBelongToDockChanges,
  };
}

export type HandController = ReturnType<typeof createHandController>;
