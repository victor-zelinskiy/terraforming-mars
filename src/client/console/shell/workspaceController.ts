/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKSPACE CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {consoleCardActionsUi, resetCardActionsFilter} from '@/client/console/consoleCardActions';
import {terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import {ConsoleSheetRow} from '@/client/components/console/consoleSheetTypes';
import {maFocusState} from '@/client/console/consoleMaFocus';
import {collapseWorkspaceStack, workspaceKindSpec, enterWorkspace, leaveWorkspace, pushWorkspaceFrame, workspaceFrameIndex, workspaceFrameRenders, workspaceFrameKnown, workspaceFrameParked, workspaceStackCollapsed, workspaceStackState, FrameAnchor, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {resetStdProjectsFlow} from '@/client/console/consoleStdProjects';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {isHandRevealEpisodeRunning} from '@/client/console/handDock/handRevealDirector';
import {conWsPresence} from '@/client/console/conWsPresenceBridge';
import {surfaceClear, surfaceHoldsTokens} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {boardPeekState} from '@/client/console/boardPeek';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {setConsoleTaskHandoffPending} from '@/client/console/consoleLeakDetector';
import {destinationServesShellTask} from '@/client/console/shellTaskSurface';
import {consoleState} from '@/client/console/consoleRouter';
import {handoffPendingEntries} from '@/client/console/shell/shellFlowState';
import {infoModeState} from '@/client/console/infoModeState';
import {ScreenHandoffOptions, screenHandoffOwed, waitScreenHandoff} from '@/client/console/screenHandoff';
import {PARLIAMENT_DOOR} from '@/client/console/parliament/parliamentDoorHandoff';
import type {SeatController} from '@/client/console/shell/seatController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {HandController} from '@/client/console/shell/handController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {InfoController} from '@/client/console/shell/infoController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {MaController} from '@/client/console/shell/maController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {RailController} from '@/client/console/shell/railController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {RouterController} from '@/client/console/shell/routerController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {StartController} from '@/client/console/shell/startController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';

/** A collapse owed until the band surfaces' tokens have landed (a plain flag — read only by the collapse itself). */
let collapseOwedOnTokens = false;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type WorkspacePort = {
  $nextTick(fn?: () => void): Promise<void>,
  actionBlockedReason: UnwrapRef<SeatController['actionBlockedReason']>,
  boardHomeIdle: UnwrapRef<MandatoryController['boardHomeIdle']>,
  collapseWithHandGather: UnwrapRef<HandController['collapseWithHandGather']>,
  consoleRevealMode: UnwrapRef<RevealController['consoleRevealMode']>,
  readonly contextOverlayMode: 'placement' | 'cell' | 'track' | undefined,
  deferShellTask: UnwrapRef<MandatoryController['deferShellTask']>,
  dockBehindWorkspace: UnwrapRef<HandController['dockBehindWorkspace']>,
  dockIntakeAccent: UnwrapRef<HandController['dockIntakeAccent']>,
  endgameStageUp: UnwrapRef<FinaleController['endgameStageUp']>,
  handAlbumParked: UnwrapRef<HandController['handAlbumParked']>,
  infoWorkspaceUp: UnwrapRef<InfoController['infoWorkspaceUp']>,
  journalPanelVisible: UnwrapRef<JournalController['journalPanelVisible']>,
  maScreenItems: UnwrapRef<MaController['maScreenItems']>,
  maScreenKind: UnwrapRef<MaController['maScreenKind']>,
  playedTableVisible: UnwrapRef<PlayedController['playedTableVisible']>,
  readonly playerView: PlayerViewModel,
  railPlayer: UnwrapRef<RailController['railPlayer']>,
  restoreDeferredTask: UnwrapRef<MandatoryController['restoreDeferredTask']>,
  settleHydroResolution: UnwrapRef<HydroController['settleHydroResolution']>,
  readonly sheetRows: Array<ConsoleSheetRow>,
  shellTask: UnwrapRef<RouterController['shellTask']>,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  startSceneVisible: UnwrapRef<StartController['startSceneVisible']>,
  stdProjectItems: UnwrapRef<StdProjectsController['stdProjectItems']>,
};

export function createWorkspaceController(shell: WorkspacePort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The workspace is PARKED — hidden for board inspection while its
   * committed decision stays alive at full depth. A property of the STACK,
   * never of one surface: that is what makes «half-collapse» (one axis
   * cleared, the other still routing input into an invisible workspace)
   * unexpressible.
   */
  const workspaceCollapsed = computed((): boolean => {
    return workspaceStackCollapsed();
  });

  /**
   * The strategy rail is NOT watchable: the player left the board home, or a
   * workspace / cinematic / full-bleed layer stands over the rail's edge.
   * While true the rail QUEUES its seal beats — they play on the uncover as
   * the continuation of the workspace ceremony, never underneath one.
   */
  const strategyRailCovered = computed((): boolean => {
    // Deliberately NOT the mandatory announce: the plate is centre-stage
    // while the rail seals at the edge — result first, demand beside it.
    return !shell.boardHomeIdle ||
      shell.consoleRevealMode !== undefined ||
      shell.startSceneVisible;
  });

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
  const workspaceScreenUp = computed((): boolean => {
    // The «РАЗЫГРАНО» table takes the opening in BOTH of its lives — the manual browse and the hero landing.
    return workspaceStackShown.value ||
      shell.infoWorkspaceUp ||
      shell.playedTableVisible;
  });

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
  const workspaceStackShown = computed((): boolean => {
    return workspaceStackState.frames.some(
      (f) => f.kind !== 'endgame' || shell.endgameStageUp);
  });

  /** The right rail's zone is TAKEN (`.con-root--rail-replaced`) — read by
   *  the policy class and by the rail itself, which freezes its paint for
   *  as long as it is not drawn (PL-155). */
  const strategyRailReplaced = computed((): boolean => {
    return workspaceScreenUp.value ||
      shell.journalPanelVisible ||
      shell.contextOverlayMode !== undefined;
  });

  const conRootClasses = computed((): Record<string, boolean> => {
    const classes: Record<string, boolean> = {
      'con-root--rail-replaced': strategyRailReplaced.value,
      // Post-game: the gameplay HUD leaves — status strip and player rail
      // fade out (visibility, never display: the boxes must survive), so
      // nothing on the frame can pre-reveal a total mid-ceremony.
      'con-root--endgame': shell.endgameStageUp,
      // The DOM-presence flags that used to be `.con-root:has(...)` rules
      // (`.con-ws` / `.con-ws--dockcover` / planet focus). Same semantics —
      // true while a matching element exists, leave transitions included —
      // maintained by conWsPresenceBridge, because a root-anchored `:has()`
      // re-ran a WHOLE-DOCUMENT style recalc per animated frame (measured
      // ~1.2 s per 100-card category flight; ~37 ms with plain classes).
      'con-root--ws-open': conWsPresence.wsOpen,
      'con-root--ws-dockcover': conWsPresence.wsDockcover,
      'con-root--pfocus': conWsPresence.planetFocus,
      // «МАРС ТЕРРАФОРМИРОВАН» (TR70 — `terraformedScene.ts`): the interface RECEDES by opacity around the real
      // planet (`--terraformed`), returns through a class that carries the fade's transition (`--terraformed-
      // returning` — a transition declared only on the receded class would snap when it drops), and where a
      // SECTION stood on the board's slot the board stands in for it (`--terraformed-stage`, lit a frame later).
      'con-root--terraformed': terraformedSceneState.receded,
      'con-root--terraformed-returning': terraformedSceneState.returning,
      'con-root--terraformed-stage': terraformedSceneState.stage !== 'off',
      'con-root--terraformed-stage-lit': terraformedSceneState.stage === 'lit',
      // The dock-cover exception for the BODIES layer (single-owner
      // rework): the docked pack lives on `.con-handreveal-layer`, whose
      // z must drop under a `--ws-dockcover` panel exactly like the old
      // pack did — EXCEPT while cards are physically arriving (the intake
      // accent), when the dock is FULL and on top by the presence
      // contract. Root-level because the layer is not a dock descendant.
      'con-root--dock-intake': shell.dockIntakeAccent,
      // …and the BEHIND-WORKSPACE tuck (colonies / hydro sections, the
      // drafting phases): the whole footer drops to z:-1 there — the
      // docked fan must follow it under the section content, or the
      // cards paint over the very rail the plate just tucked behind
      // (the reported «на workspace карты поднимаются выше дока»).
      'con-root--footer-behind': shell.dockBehindWorkspace,
      // THE BOARD PEEK (TR45): `--peeking` from the press to the workspace's full return (it carries the fade both
      // ways), `--board-peek` while the board IS the screen (the workspace and the shared dim recede).
      'con-root--peeking': boardPeekState.peek !== undefined,
      'con-root--board-peek': boardPeekState.shown,
    };
    // The inspected player's ACCENT tokens (--con-insp-accent*) — consumed
    // by the rail ring, the workspace seam AND the hand dock's inspection
    // accent (the dock lives in the footer, which is why the class rides
    // the ROOT: the custom properties inherit into all three). Follows
    // `open` (not the closing tail): everything returns to its neutral
    // chrome the moment the context comes home; the fading workspace
    // falls back to cyan.
    if (infoModeState.open) {
      classes[`con-insp-${shell.railPlayer.color}`] = true;
    }
    return classes;
  });

  const conMainClasses = computed((): Record<string, boolean> => {
    return {
      'con-main--journal': shell.journalPanelVisible,
      'con-main--hand': consoleState.section === 'hand',
      'con-main--info': shell.infoWorkspaceUp,
      // (No workspace entry here: every workspace surface carries the
      // `con-ws` marker and `.con-root--ws-open` lifts the rail /
      // drops the stacking trap for the whole family, holding through
      // leave transitions automatically.)
    };
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── THE WORKSPACE STACK — the shell's whole navigation vocabulary ──────
  /** Presence, from the stack. The ONE `v-if` of every hostable screen —
   *  re-exported here because an Options-API template resolves against the
   *  instance, not the module scope. */
  function ownWorkspaceFrameRenders(kind: WorkspaceFrameKind): boolean {
    return workspaceFrameRenders(kind);
  }

  /** B = one logical level (template door — same reason as above). */
  function ownLeaveWorkspace(): void {
    leaveWorkspace();
  }

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
  function collapseWorkspace(): void {
    // A SURFACE NEVER FOLDS UNDER ITS OWN TOKEN — a collapse is a fold too (inventory R16: B collapsed the Parliament
    // while a fighter flew to Arwind's capsule INSIDE it — `[transfer] surface folded under its token`). The B is OWED:
    // the collapse waits for the band surfaces' tokens to land (`surfaceClear`, bounded), then runs; a B meanwhile is
    // the same press, absorbed.
    const carrying = Array.from(document.querySelectorAll('.con-ws')).find((el) => surfaceHoldsTokens(el));
    if (carrying !== undefined) {
      if (!collapseOwedOnTokens) {
        collapseOwedOnTokens = true;
        void surfaceClear(carrying).then(() => {
          collapseOwedOnTokens = false;
          if (workspaceStackState.frames.length > 0 && !workspaceStackCollapsed()) {
            collapseWorkspace();
          }
        });
      }
      return;
    }
    // THE HAND GOES HOME PHYSICALLY. Collapsing a stack whose visible step
    // is the OPEN hand plays the standard gather (grid → dock) first — the
    // bare park v-ifs the grid away and every dock back popped in on one
    // frame («карты в доке просто появляются одним кадром»). Reduced motion
    // keeps the instant park (its own honest short form), and a running
    // episode already owns the moment.
    //
    // …but only while the ALBUM IS THE THING ON SCREEN. Collapsing from a
    // committed stage (the play's landing scene) measured the PARKED grid
    // and flew the pack out of a shelf nobody could see — the same «летят
    // непонятно откуда» as the fold. There the pack is already home
    // (`handCardsBelongToDock`), so the park is all that is left to do.
    if (consoleState.section === 'hand' && handRevealState.phase === 'open' &&
        !shell.handAlbumParked && !isHandRevealEpisodeRunning() && !consoleReducedMotionActive()) {
      void shell.collapseWithHandGather();
      return;
    }
    parkWorkspaceStack();
  }

  /** The bare park — the collapse's state half, shared by both paths. */
  function parkWorkspaceStack(): void {
    collapseWorkspaceStack();
    consoleState.task.deferred = true;
    // The composer's command contract is published to a SHARED store and
    // released in its own `beforeUnmount` — one flush too late, so the bar
    // would advertise a stage that no longer serves for a frame. Clearing it
    // here is what makes the collapse atomic.
    resetConsoleActionComposerUi();
  }

  /**
   * ── A LATERAL OPEN OF A KIND WHOSE PARK OWNS ITS FLOW ─────────────────
   *
   * The console's law is «a wheel open is посмотреть, never вернуться»: a
   * FRESH instance beside the park, read-only while a decision is owed, with
   * RESUME keeping exactly two doors. A workspace earns that by being able to
   * open genuinely fresh — `card-actions` and `standard-projects` reset.
   *
   * `parkOwnsFlow` marks the ones that cannot (see the registry): their flow
   * record is module-level and still LIVE, so the second instance adopts it
   * and stands a contentless twin — a committed workspace with no content,
   * «Ⓐ Выполняется» as its only verb and B dead by phase. For those, and only
   * those, the press routes through the park's own door: you cannot be inside
   * the same workspace twice, so it can only mean «верни меня туда».
   *
   * Returns true when a FRESH instance was entered (the caller may seat its
   * cursor); false when the park answered and the caller must not.
   */
  function enterOrRestoreWorkspace(kind: WorkspaceFrameKind): boolean {
    if (workspaceKindSpec(kind).parkOwnsFlow === true && restoreParkedWorkspace(kind)) {
      return false;
    }
    shell.deferShellTask(kind);
    enterWorkspace(kind);
    return true;
  }

  function openSheet(sheet: WorkspaceFrameKind): void {
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
    // ⚠️ …EXCEPT WHEN THE PARK ALREADY OWNS THIS VERY KIND. You cannot be
    // inside the same workspace twice, so «открой Гидросеть» from the wheel
    // while the Hydronetwork's OWN chain is set aside can only mean «верни
    // меня туда» — there is no second Hydronetwork to browse. A fresh lateral
    // instance stood a CONTENTLESS TWIN of a workspace that is mid-flow (its
    // traversal parked in module state, its prompt owed by the parked chain),
    // and that screen is sealed: a committed frame with no content, «Ⓐ
    // Выполняется» as its only verb, and B dead by phase. The park's own door
    // is the honest answer, and it lands the player exactly where the decision
    // is (the deepest frame — the colony they still owe an answer to).
    if (workspaceKindSpec(sheet).parkOwnsFlow === true && restoreParkedWorkspace(sheet)) {
      consoleState.quick = undefined;
      return;
    }
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
    // The sheet IS the question's surface (a prompt's standard project, the free award funding) — the one predicate
    // every defer asks (`shellTaskSurface.ts`).
    const isTaskSurface = !parkOwed && destinationServesShellTask(shell.shellTask, sheet);
    if (!isTaskSurface) {
      shell.deferShellTask(sheet);
    } else {
      consoleState.task.deferred = false;
    }
    consoleState.quick = undefined;
    enterWorkspace(sheet);
    // THE CURSOR IS SEEDED BEFORE THE FIRST RENDER (TR58): the screen used to mount on the PREVIOUS visit's index and
    // be re-seated a tick later — the ring stood on one row and jumped to another while the screen entered. The
    // projections are synchronous after `enterWorkspace`, so the seat is known now; the tick only re-asks it (a
    // restore door that seats a detail in between still wins), which lands on the same row.
    seedSheetCursor(sheet);
    void shell.$nextTick(() => seedSheetCursor(sheet));
  }

  /** P26/P27: the MA + Std-Projects screens focus the first ACTIONABLE card, else the top row. */
  function seedSheetCursor(sheet: string): void {
    // A RESTORED MA detail owns the cursor (the task-restore door seated it on the draft item) — never re-home it.
    if (maFocusState.open) {
      return;
    }
    const selectables = shell.maScreenKind !== undefined ?
      shell.maScreenItems.map((it) => ({header: false, available: it.available})) :
      sheet === 'standard-projects' ?
        shell.stdProjectItems.map((it) => ({header: false, available: it.available})) :
        shell.sheetRows.map((r) => ({header: r.kind === 'header', available: r.available}));
    const firstAvailable = selectables.findIndex((s) => !s.header && s.available);
    const firstSelectable = selectables.findIndex((s) => !s.header);
    consoleState.sheetIndex = firstAvailable !== -1 ? firstAvailable : Math.max(0, firstSelectable);
  }

  function activateSheetRow(row: ConsoleSheetRow | undefined): void {
    if (row === undefined || row.kind === 'header') {
      return;
    }
    // The overlays stay OPEN for inspection while something is owed, but
    // STARTING another action would desync the prompt the server is holding.
    if (shell.actionBlockedReason !== '') {
      shell.showNotice(shell.actionBlockedReason);
      return;
    }
    if (!row.available) {
      shell.showNotice(row.reason !== undefined && row.reason !== '' ? row.reason : 'Unavailable right now');
      return;
    }
    // (No generic sheet carries activatable rows today — the premium
    // screens each own their activation path.)
  }

  /**
   * Stand the action workspace back up around a party flow the server is
   * mid-way through (the Reds' discard after a reload / from the board-home
   * plate): the same composer, past its commit, with the party record the
   * conclusion holds on — the door's RESUME shape (`openWith.resume`).
   */
  function resumePartyActionWorkspace(party: ReduxParty): void {
    resetCardActionsFilter();
    consoleCardActionsUi.openWith = {party, resume: true};
    pushWorkspaceFrame({
      kind: 'card-actions',
      subject: party,
      stage: focusKicker('setup'),
      phase: 'committed',
      serves: [],
      anchor: {type: 'always'},
      overlay: workspaceStackState.frames.length > 0,
    });
  }

  /**
   * ENTER A WORKSPACE ONCE THE SCREEN IS HANDED OVER (state delivery, 2026-10-28): the doors a mandatory plate
   * opens into a PHASE-ROOT flow (the draft, the Parliament's sitting) take the whole screen — a card still
   * flying into the dock, a reveal not taken, a foreign tile landing finish first. The press is honoured (the
   * beat is acknowledged by the caller), the entry is deferred to the director's quiet; a second press meanwhile
   * finds the entry pending and adds nothing. Immediate when nothing is owed — the ordinary case.
   */
  function enterWorkspaceAfterHandoff(kind: WorkspaceFrameKind, opts: {anchor: FrameAnchor}): void {
    if (workspaceFrameKnown(kind) || handoffPendingEntries.has(kind)) {
      return;
    }
    // THE SITTING OWNS THE BOARD'S STORIES (its world beat steps aside for the planet and for another seat's tile;
    // its reward beat flies the rail holds seeded for it) — a door into it waits for the player's own owed objects
    // only, or it waits for a landing that waits for the sitting to stand (the field lock of 2026-10-28).
    // …and never for a reveal the sitting PARKED for its own beat (`PARLIAMENT_DOOR` — the 2026-10-30 deadlocks).
    const handoff: ScreenHandoffOptions = kind === 'parliament' ? PARLIAMENT_DOOR : {};
    if (!screenHandoffOwed(handoff)) {
      enterWorkspace(kind, opts);
      return;
    }
    handoffPendingEntries.add(kind);
    setConsoleTaskHandoffPending(true); // the prompt is served by the entry that is owed — never a strand
    void waitScreenHandoff(`enter:${kind}`, {...handoff, alive: () => shell.playerView?.game !== undefined}).then((outcome) => {
      handoffPendingEntries.delete(kind);
      setConsoleTaskHandoffPending(handoffPendingEntries.size > 0);
      if (outcome !== 'dead' && !workspaceFrameKnown(kind)) {
        enterWorkspace(kind, opts);
      }
    });
  }

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
  function restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean {
    if (workspaceFrameIndex(kind) === -1 && workspaceFrameParked(kind)) {
      shell.restoreDeferredTask();
      return true;
    }
    return false;
  }

  /**
   * …AND THE PARK RE-ASKS ON THE WAY BACK.
   *
   * The rule above is «a PARK is not completion», and it was implemented as
   * an early return — which drops the edge instead of deferring it. A move
   * whose follow-up is a BOARD EXCURSION (the stage-7 copy asking for its
   * space) parks the whole stack for the placement, so the resolution's busy
   * signals fall to quiet WHILE parked: the watcher above refused, the
   * restore fired no edge of its own (`busy` was already false), and the
   * flow sat in `resolving` for the rest of the session — the track came
   * back to its browse view and the movement's own summary never played.
   *
   * A watcher cannot fire on true→true, so the restore has to ask again —
   * from BOTH restore edges (the stack's, here, and the deferred task's,
   * folded into `consoleState.task.deferred` above).
   */
  function whenWorkspaceCollapsedChanges(collapsed: boolean): void {
    if (!collapsed) {
      void shell.$nextTick(() => shell.settleHydroResolution());
    }
  }

  return {
    workspaceCollapsed,
    strategyRailCovered,
    workspaceScreenUp,
    workspaceStackShown,
    strategyRailReplaced,
    conRootClasses,
    conMainClasses,
    workspaceFrameRenders: ownWorkspaceFrameRenders,
    leaveWorkspace: ownLeaveWorkspace,
    collapseWorkspace,
    parkWorkspaceStack,
    enterOrRestoreWorkspace,
    openSheet,
    seedSheetCursor,
    activateSheetRow,
    resumePartyActionWorkspace,
    enterWorkspaceAfterHandoff,
    restoreParkedWorkspace,
    whenWorkspaceCollapsedChanges,
  };
}

export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
