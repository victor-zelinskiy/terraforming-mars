/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SHELL'S MEMBERS — the composition root of the game screen (architecture v2 — docs/claude/console/
 * architecture-v2/PLAN.md §5 · S-last: the shell is layout).
 *
 * Everything the template of `ConsoleShell.vue` reads by name is ONE object, built here in ONE order: the shell's own
 * template refs and the surface registry, the MIRRORS of module state, and what each domain's controller returns. The
 * component's `setup()` returns it (`useConsoleShell.ts`) and declares nothing beside it — no `data`, no `computed`,
 * no `methods`, no `watch`, no hooks: a `<script setup>` / Vapor shell would run the very same composition.
 *
 * THE ORDER OF CONSTRUCTION IS LOAD-BEARING: a controller's own watchers and hooks are created when it is constructed,
 * and the scheduler keeps that order between watchers of one source. A new controller goes at the END.
 *
 * A controller never takes this object — it takes its PORT (`port.as<XPort>()`, `shellPort.ts`), and
 * `shellPortsConform` below is the proof (plain tsc AND vue-tsc) that the composed shell provides every port.
 */
import {ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {consoleSystemAlertState} from '@/client/console/consoleSystemAlertState';
import {deckPickState} from '@/client/console/deckPick/consoleDeckPick';
import {stdProjectCommitState} from '@/client/console/consoleStdProjectCommit';
import {cardDiscardTransaction} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyBonusEntry, colonyBonusSequence} from '@/client/console/colonyTrade/colonyResolution';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyTradeState} from '@/client/console/colonyTrade/consoleColonyTrade';
import {conWsPresence} from '@/client/console/conWsPresenceBridge';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {colonyFocusState} from '@/client/console/consoleColoniesModel';
import {boardPeekState} from '@/client/console/boardPeek';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';
import {leakDetectorState} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {hydroMarkerState} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';
import {planetFocusState} from '@/client/console/planetFocus';
import {patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import {tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import {placementFlowState} from '@/client/console/tilePlacement/placementFlow';
import {nomadMoveState} from '@/client/console/nomads/consoleNomadMove';
import {consoleState} from '@/client/console/consoleRouter';
import {wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {consoleHandPickState} from '@/client/console/consoleHandPick';
import {consoleRepeatPickState} from '@/client/console/consoleRepeatPick';
import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
import {infoModeState} from '@/client/console/infoModeState';
import {colonyTrackMoveFlow} from '@/client/console/colonyTrade/colonyTrackMove';
import {createViewerController, ViewerPort} from '@/client/console/shell/viewerController';
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
import {createWiringController, WiringPort} from '@/client/console/shell/wiringController';
import {ShellOf, ShellPortSource} from '@/client/console/shell/shellPort';

/** The props of `ConsoleShell.vue` — what the app hands the game screen. */
export type ShellProps = {
  readonly playerView: PlayerViewModel,
  /** The LIVE list of players the server is waiting on (see the prop's own comment in the SFC). */
  readonly waitingOnPlayers: ReadonlyArray<Color>,
};

/**
 * THE MIRRORS — module reactive state the template reads by name (and the reactions table by path). Each is the
 * module's own reactive object: nothing is copied, and a controller reads the import itself, never the mirror.
 *
 * (The notes on the fields date from the Options component, where a path key of the `watch` block resolved against
 * the instance and a module state missing from `data()` made its watcher silently never fire. That failure is gone —
 * a row of `shellReactions.ts` reads its path off the typed shell and does not COMPILE without its mirror — so read
 * «in data()» below as «a member of the shell»: each note still says which reader the mirror is for.)
 */
function shellMirrors() {
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
    /** The `.con-ws` DOM-presence flags (ex-`:has()`) + their observer's
     *  dispose — module reactive mirrored into data() so conRootClasses
     *  tracks it (the path-watcher data-mirror rule). */
    wsPresence: conWsPresence,
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
  };
}

export function composeShellMembers(port: ShellPortSource<ShellProps>) {
  // THE CENTRAL STAGE'S ONE GEOMETRY. Every fixed band surface and the shared
  // dim read the LIVE opening between the four hull members instead of
  // approximating it from tokens — so a modal can never reach under a bar and
  // the shade can never grey one out. The two RAILS are measured too: the
  // right one is board-home only, and a `v-show` flip that hides it moves the
  // opening's edge without resizing the column.
  // The shell's own root — what `this.$el` was (a `<script setup>` / Vapor component has no `$el`).
  const conRootEl = ref<HTMLElement>();
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
  const viewer = createViewerController(port.as<ViewerPort>());
  const ma = createMaController(port.as<MaPort>());
  const info = createInfoController(port.as<InfoPort>());
  const notice = createNoticeController();
  const wheel = createWheelController(port.as<WheelPort>());
  const cell = createCellController(port.as<CellPort>());
  const convert = createConvertController(port.as<ConvertPort>());
  const rail = createRailController(port.as<RailPort>());
  const journal = createJournalController(port.as<JournalPort>());
  const surface = createSurfaceController();
  const supervisor = createSupervisorController(port.as<SupervisorPort>());
  const seat = createSeatController(port.as<SeatPort>());
  const draft = createDraftController(port.as<DraftPort>());
  const finale = createFinaleController(port.as<FinalePort>());
  const played = createPlayedController(port.as<PlayedPort>());
  const staged = createStagedController(port.as<StagedPort>());
  const cardActions = createCardActionsController(port.as<CardActionsPort>());
  const stdProjects = createStdProjectsController(port.as<StdProjectsPort>());
  const start = createStartController(port.as<StartPort>());
  const hydro = createHydroController(port.as<HydroPort>());
  const parliament = createParliamentController(port.as<ParliamentPort>());
  const colony = createColonyController(port.as<ColonyPort>());
  const placement = createPlacementController(port.as<PlacementPort>());
  const mandatory = createMandatoryController(port.as<MandatoryPort>());
  const reveal = createRevealController(port.as<RevealPort>());
  const outcome = createOutcomeController(port.as<OutcomePort>());
  const router = createRouterController(port.as<RouterPort>());
  const playCard = createPlayCardController(port.as<PlayCardPort>());
  const handSelect = createHandSelectController(port.as<HandSelectPort>());
  const hand = createHandController(port.as<HandPort>());
  const workspace = createWorkspaceController(port.as<WorkspacePort>());
  const commandBar = createCommandBarController(port.as<CommandBarPort>());
  const padRouter = createPadRouterController(port.as<PadRouterPort>());
  const viewApply = createViewApplyController(port.as<ViewApplyPort>());
  const wiring = createWiringController(port.as<WiringPort>());
  return {...shellMirrors(), conRootEl, conMainEl, conRailEl, conStratEl, surfaces, ...viewer, ...ma, ...info, ...notice, ...wheel, ...cell, ...convert, ...rail, ...journal, ...surface, ...supervisor, ...seat, ...draft, ...finale, ...played, ...staged, ...cardActions, ...stdProjects, ...start, ...hydro, ...parliament, ...colony, ...placement, ...mandatory, ...reveal, ...outcome, ...router, ...playCard, ...handSelect, ...hand, ...workspace, ...commandBar, ...padRouter, ...viewApply, ...wiring};
}

export type ShellMembers = ReturnType<typeof composeShellMembers>;
/** The shell as a controller's port (and the reactions table) sees it. */
export type Shell = ShellOf<ShellMembers, ShellProps>;

/**
 * THE SHELL IS WHAT ITS CONTROLLERS' PORTS SAY. Never called: each row is a compile-time proof that the composed shell
 * still provides every member a controller reads, calls or writes, with the type the controller expects. A new
 * controller with a port adds its row (guarded — `tests/console/shellControllers.spec.ts`); a row goes when its port is
 * empty.
 */
export function shellPortsConform(shell: Shell): void {
  const viewerPort: ViewerPort = shell;
  void viewerPort;
  const maPort: MaPort = shell;
  void maPort;
  const infoPort: InfoPort = shell;
  void infoPort;
  const wheelPort: WheelPort = shell;
  void wheelPort;
  const cellPort: CellPort = shell;
  void cellPort;
  const convertPort: ConvertPort = shell;
  void convertPort;
  const railPort: RailPort = shell;
  void railPort;
  const journalPort: JournalPort = shell;
  void journalPort;
  const supervisorPort: SupervisorPort = shell;
  void supervisorPort;
  const seatPort: SeatPort = shell;
  void seatPort;
  const draftPort: DraftPort = shell;
  void draftPort;
  const finalePort: FinalePort = shell;
  void finalePort;
  const playedPort: PlayedPort = shell;
  void playedPort;
  const stagedPort: StagedPort = shell;
  void stagedPort;
  const cardActionsPort: CardActionsPort = shell;
  void cardActionsPort;
  const stdProjectsPort: StdProjectsPort = shell;
  void stdProjectsPort;
  const startPort: StartPort = shell;
  void startPort;
  const hydroPort: HydroPort = shell;
  void hydroPort;
  const parliamentPort: ParliamentPort = shell;
  void parliamentPort;
  const colonyPort: ColonyPort = shell;
  void colonyPort;
  const placementPort: PlacementPort = shell;
  void placementPort;
  const mandatoryPort: MandatoryPort = shell;
  void mandatoryPort;
  const revealPort: RevealPort = shell;
  void revealPort;
  const outcomePort: OutcomePort = shell;
  void outcomePort;
  const routerPort: RouterPort = shell;
  void routerPort;
  const playCardPort: PlayCardPort = shell;
  void playCardPort;
  const handSelectPort: HandSelectPort = shell;
  void handSelectPort;
  const handPort: HandPort = shell;
  void handPort;
  const workspacePort: WorkspacePort = shell;
  void workspacePort;
  const commandBarPort: CommandBarPort = shell;
  void commandBarPort;
  const padRouterPort: PadRouterPort = shell;
  void padRouterPort;
  const viewApplyPort: ViewApplyPort = shell;
  void viewApplyPort;
  const wiringPort: WiringPort = shell;
  void wiringPort;
}
