/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE STAGED CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {PlacementEffect, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {consoleCardActionsUi, politicalSourceKey} from '@/client/console/consoleCardActions';
import {SpaceId} from '@/common/Types';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {discardYieldedStack, resumeStackFromBoard, popWorkspaceFrame, setWorkspaceFramePhase, workspaceStackTop, workspaceFrameHost, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {handStageTransitioning} from '@/client/console/consoleHandStageMotion';
import {abortPlayedHero, armPlayedHero, isPlayedHeroActive, runStagedPlayedLanding, finishStagedPlayedLanding} from '@/client/console/played/consolePlayedHero';
import {closeColonyFocus} from '@/client/console/consoleColoniesModel';
import {setPlayComposerStagedDraft} from '@/client/console/consolePlayCardUi';
import {stageArmedSpends} from '@/client/console/armedEffectFlight';
import {markWorkspaceOutcomeBeatDone} from '@/client/console/consoleWorkspaceOutcome';
import {claimPlayOutcome} from '@/client/console/played/consolePlayOutcomeClaim';
import {moveLevelPrompt, placementMoveState, resetPlacementMove} from '@/client/console/tilePlacement/placementMove';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleState} from '@/client/console/consoleRouter';
import {isSurfaceAwaitingHandoff} from '@/client/console/surfaceMotion/surfaceMotionState';
import {probeTick} from '@/client/console/probeTick';
import {beginLawPlayLanding, clearLawPlayDraft, endLawPlayLanding, lawPlayLandingOf} from '@/client/console/consolePlayPick';
import {resolutionTileKey} from '@/client/console/parliament/partyActionKey';
import {ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {stagedPlayState, stagedPlayActive, stagedPlacementOf, nestCellInBranchPick, armStagedSeal, markStagedPlayCommitting, clearStagedPlay} from '@/client/console/stagedPlay';
import type {StagedPlayArm} from '@/client/console/stagedPlay';
import type {StagedColonyModel, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {clearColonyTrackMove} from '@/client/console/colonyTrade/colonyTrackMove';
import {colonyRosterDraft} from '@/client/console/colonyRoster/consoleColonyRoster';
import {PendingPlayCard} from '@/client/console/shell/shellShared';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import {span} from '@/client/console/session/sessionWaits';

/** The bound of an owed staged B (T15 · CD) — the hand-off's holds are bounded themselves; this only names a stall. */
const STAGED_BACK_OWED_MAX_MS = 6000;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type StagedPort = {
  armBoardBonusIfCardCell(spaceId: string, placementEffect?: PlacementEffect): void,
  readonly boardSpaceIds: ReadonlyArray<SpaceId>,
  departingPlayCard: CardName | undefined,
  enterStagedColony(arm: StagedPlayArm): Promise<void>,
  enterStagedPlacement(arm: StagedPlayArm): void,
  enterStagedVote(arm: StagedPlayArm): Promise<void>,
  /** WRITTEN here. */ pendingPlayCard: PendingPlayCard | undefined,
  readonly placementActive: boolean,
  playedOpen: UnwrapRef<PlayedController['playedOpen']>,
  readonly playerView: PlayerViewModel,
  returningPlayCard: CardName | undefined,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  readonly stagedColonyModel: StagedColonyModel | undefined,
  readonly stagedVoteModel: StagedVoteModel | undefined,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
};

export function createStagedController(shell: StagedPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A B pressed in the STAGED landing's tail (the board already holds the staged placement while the landed
   *  card's proxy dissolves) — OWED, not swallowed: it cancels the staged play the moment the scene is idle (PL-581). */
  const stagedBackOwed = ref(false);
  /** THE STAGED LANDING RITUAL is playing (the card lifting onto its stack BEFORE the board — nothing sent): a B
   *  pressed in it is OWED to the ritual's own end (T15 · CD), never swallowed by the scene's absorb. */
  const stagedLandingInFlight = ref(false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const stagedPlayPrompt = computed((): SelectSpaceModel | undefined => {
    const arm = stagedPlayState.arm;
    const p = stagedPlacementOf(arm);
    if (arm === undefined || p === undefined) {
      return undefined;
    }
    return {
      type: 'space',
      title: p.title,
      buttonLabel: '',
      spaces: p.spaces,
      illegalSpaces: p.illegalSpaces,
      hiddenTiles: p.hiddenTiles,
      placementType: p.placementType,
      tileType: p.tileType,
      sourceCard: p.sourceCard,
      // 'bonus-only' (Mars Nomads' move) / 'marker' (St. Joseph) ride the
      // staged model — the board arming, the dossier pricing and the cell
      // preview all read this exactly as they read the live prompt's.
      placementEffect: p.placementEffect,
      placementContext: {cancellable: true, source: {kind: 'card', card: p.sourceCard}},
      followUpPlacements: p.followUpPlacements,
      // A staged MOVE (TR14): which city reaches which cell — the same marker the live prompt carries.
      tileMove: p.tileMove,
      // A multiplied printed bonus (P74 Frontier Town): the staged dossier asks with the live prompt's `bonus`, and the
      // board marks every candidate «×N» from the same number.
      printedBonusMultiplier: p.printedBonusMultiplier,
      printedBonusTimes: p.printedBonusTimes,
      // The World Government places it (P67 · GK): the dossier asks the cell in the government's mode.
      ...(p.government === true ? {governmentPlacement: true as const} : {}),
    };
  });

  /**
   * The staged prompt AT ITS LEVEL — what the staged binder is wired to. For
   * a move it is «which city» until one is lifted, then «which cell»
   * (`placementMove.moveLevelPrompt`); for every other staged placement it
   * is `stagedPlayPrompt` itself.
   */
  const stagedPlayLevelPrompt = computed((): SelectSpaceModel | undefined => {
    const prompt = stagedPlayPrompt.value;
    return prompt === undefined ? undefined : moveLevelPrompt(prompt, placementMoveState.from, shell.boardSpaceIds);
  });

  // The VISIBLE hand — narrowed by the active tag filter (sale mode always
  // shows the whole hand). This is what the grid renders + what handIndex
  // indexes into, so play / inspect / command-bar all read the filtered set.
  /** The card whose HAND SLOT is held empty (Vue-managed, patch-proof):
   *  staged in the play composer, mid-return after cancel, or departing
   *  after a successful play (until the server removes it from the hand).
   *  One physical card never sits in two places at once. */
  const stagedHandCard = computed((): CardName | undefined => {
    // …and while a STAGED VOTE stands: the composer is gone (the Parliament
    // took its zone) but the card has not left the hand — it is «being played».
    // (A PLAY's arm only: an ACTION's card is on the table, never in the hand.)
    // (…and a card played THROUGH A LAW (RX36) whatever its door: the card is «being played» from the hand until
    // the commit lands — the slot in the law's stage carries it, never a second copy in the dock.)
    const arm = stagedPlayState.arm;
    return shell.pendingPlayCard?.cardName ?? shell.returningPlayCard ?? shell.departingPlayCard ??
      (arm !== undefined && (arm.flow === 'law' || ((shell.stagedVoteModel !== undefined || shell.stagedColonyModel !== undefined) && arm.flow === 'play')) ?
        arm.cardName : undefined);
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE STAGED LANDING CEREMONY (docs/TILE_PLAY_STAGED_COMMIT.md §8-bis):
   * the tabletop beat — the card lifts off the composer and lands on its
   * family stack in the workspace's receiving stage — played BEFORE any
   * submit. Nothing server-side exists yet, so the honesty rules are: no
   * counter ticks, no reward beat (the gains fly from the placed tile after
   * the real commit), and the proxy dissolves WITH the leaving workspace at
   * the handoff. A mid-ceremony abort restores the composer (the 'failed'
   * watcher re-arms its CTA) and simply does not hand off — the play is
   * «not made», honestly.
   */
  async function beginStagedPlayLanding(pending: PendingPlayCard, isEvent: boolean, arm: StagedPlayArm): Promise<void> {
    // The beat is a transient: input is absorbed by PHASE for its length
    // (backVerb 'none'), exactly like every committed beat — except this
    // one's «commit» is still ahead, on the board.
    setWorkspaceFramePhase('hand', 'executing');
    stagedLandingInFlight.value = true;
    stagedBackOwed.value = false;
    // The one-play class (TR49): what this play spends rides the ritual — drawn out of the dock into the card.
    stageArmedSpends(arm.armedSpends ?? []);
    armPlayedHero(pending.cardName, isEvent, {
      manualTableOpen: shell.playedOpen,
      host: 'workspace',
      sourceFace: {lightweight: false, card: pending.input.cards.find((c) => c.name === pending.cardName)},
      // No reveal ever happens here (the proxy IS the landed card until the
      // board takes over) — it lands wearing the stage's own tier.
      landingFace: {lightweight: true, model: 'none'},
    });
    const landed = await runStagedPlayedLanding();
    if (!landed || !isPlayedHeroActive()) {
      // Aborted mid-ceremony — the abort already restored the source and
      // flagged 'failed' (the watcher rolls the frame back to configure).
      stagedLandingInFlight.value = false;
      stagedBackOwed.value = false;
      return;
    }
    // The read beat: the card rests on the stack before the board takes over.
    await span(motionMs(320));
    stagedLandingInFlight.value = false;
    if (!isPlayedHeroActive() || shell.pendingPlayCard?.cardName !== pending.cardName) {
      stagedBackOwed.value = false;
      void finishStagedPlayedLanding();
      return;
    }
    // A B PRESSED DURING THE RITUAL IS OWED (T15 · CD) and is honoured HERE, at the ritual's own end: nothing was
    // sent, so the press means «back to the card» — the ordinary refusal road takes the landed card back to its
    // composer (the source restored, 'failed' re-arms the CTA, the frame back to configure, every capture intact)
    // and the board never opens. Cutting the ritual at the press would tear the frame; ignoring it lost the press.
    if (stagedBackOwed.value) {
      stagedBackOwed.value = false;
      abortPlayedHero();
      return;
    }
    if (arm.target.kind === 'resolution') {
      await shell.enterStagedVote(arm);
      return;
    }
    if (arm.target.kind === 'colony') {
      await shell.enterStagedColony(arm);
      return;
    }
    shell.enterStagedPlacement(arm);
    // The proxy — the landed card's one visible body — dissolves together
    // with the workspace's own leave, never alone over the board.
    void finishStagedPlayedLanding();
  }

  /**
   * THE ONE COMMIT OF A STAGED STEP (the vote's party, the colony's tile): the
   * one POST of the whole play, the step's answer ADDRESSED to the card as the
   * batch's tail. The frames cross their commit boundary (the hand's beat
   * absorbs a second A), the play's outcome is claimed as for any play (a
   * triggered draw belongs to this workspace) — and NO played-hero is armed:
   * the landing ritual was the play's, and it has already been seen.
   */
  function commitStagedTail(response: InputResponse, following: ReadonlyArray<InputResponse> = [], claim?: () => void): void {
    const arm = stagedPlayState.arm;
    if (arm === undefined || stagedPlayState.committing) {
      return;
    }
    markStagedPlayCommitting();
    // `following` — the answers the staged step PRE-COLLECTED for what its own answer raises (a build bonus's
    // card target): they ride BEHIND the addressed tail, in order, and the server parks whatever has not met
    // its prompt yet with it.
    if (arm.flow === 'action' || arm.flow === 'law') {
      // A CARD ACTION's commit (TR15): no play outcome to claim (the action draws nothing). The host crosses its
      // commit boundary — a second A and every B are absorbed — and the composer standing under the step plays
      // the card's ACTION COMMIT off this very edge (`stagedVoteCommitMine`).
      // …and a card played THROUGH A LAW (RX36): the law's batch (`[menu option, the card addressed to the law, …]`)
      // with the step's addressed tail — the stage it stands in is «Действия карт», never a play host.
      setWorkspaceFramePhase('card-actions', 'executing');
      shell.submitBatch([...arm.batch, response, ...following]);
      return;
    }
    claimPlayOutcome(arm.cardName, arm.draws);
    // The execution beat the claim withholds its surface for has ALREADY
    // played (the card landed before the step) — report it at once.
    markWorkspaceOutcomeBeatDone();
    // …and the step's OWN claim, when its answer owns a follow-up of its own (a build's bonus): made after
    // the play's, so the nearer host — the step's stage — is the one that receives it.
    claim?.();
    setWorkspaceFramePhase('hand', 'executing');
    shell.submitBatch([...arm.batch, response, ...following]);
  }

  /**
   * STAGED PLAY's cell confirm — THE play's one submit. The parked batch
   * posts with the chosen space appended as its tail; a `fixed` placement
   * (Noctis City's reserved on-grid cell) posts the batch unchanged — the
   * server places that cell itself, no SelectSpace ever exists for it.
   *
   * The tile hero was already armed by ConsoleBoardInput.saveData (the one
   * arming point every placement source shares); a refusal runs the
   * transport abort battery (rollback to the locked cell + re-armed
   * onclicks + `abortStagedPlayCommit`), so the play stays cancellable.
   */
  function onStagedPlaySpacePicked(spaceResponse: {type: 'space', spaceId: string, movedFrom?: string}): void {
    const arm = stagedPlayState.arm;
    const placement = stagedPlacementOf(arm);
    if (arm === undefined || placement === undefined || stagedPlayState.committing) {
      return;
    }
    markStagedPlayCommitting();
    // The card-seal wave's plan: the card's own gains will fly FROM the
    // placed tile after the hero's beats (stagedPlay.ts; play flow only —
    // an action arm carries no rewards, so this is a no-op there).
    armStagedSeal(spaceResponse.spaceId);
    shell.armBoardBonusIfCardCell(spaceResponse.spaceId, placement.placementEffect);
    // `stagedFor` is the tail's ADDRESS (the server's own sourceCard): the
    // cell lands ONLY on this card's placement prompt — a threshold bonus
    // ocean that jumps the queue parks it instead of eating or dropping it
    // (deferredInputBatch; the parked state comes back as
    // `stagedPlacementPending` and is handled in placementWorldVersion).
    // P67 · GK — a cell NESTED in the branch pick (the World Government's «Add an ocean» is a `SelectSpace` inside its
    // `OrOptions`): the cell becomes the RESPONSE of the batch's last `or` answer instead of its tail.
    const responses = placement.fixed === true ?
      [...arm.batch] :
      placement.nestedInBranch === true ? nestCellInBranchPick(arm.batch, spaceResponse) :
        [...arm.batch, {...spaceResponse, stagedFor: placement.sourceCard}];
    shell.submitBatch(responses);
  }

  /**
   * THE LAW'S STAGED RITUAL (RX36): the card lifts off the slot it stands in and lands on its pile in the law's
   * own receiving stage — presentational and reversible, nothing sent (`beginStagedPlayLanding`'s honesty rules:
   * no counter ticks, no reward beat). Then the door opens: the cell (the stage steps aside for the board), or the
   * vote / the colony as a step of the stage. A ritual that aborts gives the stage back as it was.
   */
  async function beginStagedLawLanding(arm: StagedPlayArm): Promise<void> {
    const law = arm.lawRestore?.resolution;
    if (law === undefined) {
      return;
    }
    // A transient beat: input absorbed by PHASE for its length — the commit is still ahead, behind the door.
    setWorkspaceFramePhase('card-actions', 'executing');
    stageArmedSpends(arm.armedSpends ?? []);
    beginLawPlayLanding({card: arm.cardName, resolution: law});
    armPlayedHero(arm.cardName, arm.isEvent, {
      manualTableOpen: shell.playedOpen,
      host: 'workspace',
      sourceSelector: '[data-law-play-face]',
      sourceFace: {lightweight: true},
      // No reveal happens here (the proxy IS the landed card until the door takes over).
      landingFace: {lightweight: true, model: 'none'},
    });
    const landed = await runStagedPlayedLanding();
    if (!landed || !isPlayedHeroActive()) {
      // Aborted mid-ceremony — the abort restored the source and dropped the landing (the composer's setup stands).
      setWorkspaceFramePhase('card-actions', 'configure');
      return;
    }
    // The read beat: the card rests on its pile before the door takes over.
    await span(motionMs(320));
    if (!isPlayedHeroActive() || lawPlayLandingOf(law) === undefined) {
      void finishStagedPlayedLanding();
      setWorkspaceFramePhase('card-actions', 'configure');
      return;
    }
    if (arm.target.kind === 'resolution') {
      await shell.enterStagedVote(arm);
      return;
    }
    if (arm.target.kind === 'colony') {
      await shell.enterStagedColony(arm);
      return;
    }
    shell.enterStagedPlacement(arm);
    void finishStagedPlayedLanding();
  }

  /**
   * B out of a staged placement: nothing was ever sent, so this is a pure
   * client restore — the workspace comes back at the same depth and the
   * composer re-seats every capture from the parked draft. The play is
   * simply «not yet made» again.
   */
  /**
   * THE STAGED BOARD'S B IS OWED, NEVER LOST (T15 · CD — one law for every hold of the staged hand-off; PL-581 and
   * PL-026 were two windows of it). Nothing is sent until the cell's confirm, so a B pressed while a HOLD owns the
   * pad — the landing ritual, the hero's tail, the hand's leave, the surface hand-off, the board not yet standing —
   * is the board's own «back to the card». It is TAKEN (never routed to whatever surface the hold left under the
   * pad), OWED to the hold's end and SHOWN (the bar reads «Возвращаемся…»); a second B is a no-op. Returns true when
   * the press was the staged board's.
   */
  function stagedBackOwedNow(intent: GamepadIntent, action: ConsoleAction | undefined): boolean {
    if (intent.kind !== 'press' || action !== 'back') {
      return false;
    }
    if (stagedBackOwed.value && (stagedLandingInFlight.value || stagedPlayActive())) {
      return true;
    }
    if (!stagedBackOwable()) {
      return false;
    }
    stagedBackOwed.value = true;
    void runOwedStagedBack();
    return true;
  }

  /** A staged hand-off is under way and the board's own B cannot run yet (see {@link stagedBackOwedNow}). */
  function stagedBackOwable(): boolean {
    if (stagedLandingInFlight.value) {
      return true;
    }
    const arm = stagedPlayState.arm;
    if (arm === undefined || arm.target.kind !== 'cell' || stagedPlayState.committing) {
      return false;
    }
    const boardTakesB = shell.placementActive && consoleState.section === 'board' && !stagedHandoffHolding();
    return !boardTakesB;
  }

  /** A scene of the staged hand-off still owns the moment (the hero's tail, the hand's leave, the surface hand-off). */
  function stagedHandoffHolding(): boolean {
    return isPlayedHeroActive() || handStageTransitioning() || isSurfaceAwaitingHandoff();
  }

  /**
   * The owed B runs the moment the hand-off's holds are over — read on the probe tick (the hold's own end is the
   * signal; the tick only notices it), bounded and named. A ritual still in flight honours the B at its own end
   * (`beginStagedPlayLanding`); a commit or a cleared arm voids the debt (nothing is left to go back to).
   */
  async function runOwedStagedBack(): Promise<void> {
    const deadline = Date.now() + STAGED_BACK_OWED_MAX_MS;
    while (stagedBackOwed.value) {
      if (stagedLandingInFlight.value) {
        return;
      }
      if (stagedPlayState.arm === undefined || stagedPlayState.committing) {
        stagedBackOwed.value = false;
        return;
      }
      const expired = Date.now() > deadline;
      if (!stagedHandoffHolding() || expired) {
        if (expired) {
          console.warn('[staged-play] the owed B ran past its hold (bounded):', STAGED_BACK_OWED_MAX_MS, 'ms');
        }
        stagedBackOwed.value = false;
        cancelStagedPlay();
        return;
      }
      await new Promise<void>((resolve) => probeTick(() => resolve()));
    }
  }

  function cancelStagedPlay(): void {
    const arm = stagedPlayState.arm;
    if (arm === undefined || stagedPlayState.committing) {
      return;
    }
    // (A roster pick's draft — the tile chosen to leave — belongs to the door that is being walked out of.)
    colonyRosterDraft.outgoing = undefined;
    // …and so does a move's lifted city.
    resetPlacementMove();
    if (arm.flow === 'law') {
      // B OUT OF A LAW'S STAGED DOOR (RX36) — one level: back to the law's stage, its slot as it was (the card in
      // it, the total, the commit armed). Nothing was sent, so there is nothing to undo. A hosted step (the vote,
      // the colony) leaves the stage it stood in — that stage never unmounted, its composer gives the setup back;
      // the CELL's yielded stage comes back from the board and re-seats the law's composer (the restore plan reads
      // `stagedReturn`), whose slot re-seats from the kept composed play.
      endLawPlayLanding();
      if (arm.target.kind === 'resolution' || arm.target.kind === 'colony') {
        const step = arm.target.kind === 'resolution' ? 'parliament' : 'colonies';
        if (workspaceStackTop()?.kind === step && workspaceFrameHost(step) === 'card-actions') {
          popWorkspaceFrame();
        }
        if (step === 'colonies') {
          closeColonyFocus();
          clearColonyTrackMove();
        }
        setWorkspaceFramePhase('card-actions', 'configure');
        clearStagedPlay();
        return;
      }
      const law = arm.lawRestore?.resolution;
      if (law !== undefined) {
        consoleCardActionsUi.stagedReturn = {cardName: politicalSourceKey(resolutionTileKey(law)), nodeIndex: 0, composer: undefined};
      }
      if (arm.yieldedStack) {
        resumeStackFromBoard();
        setWorkspaceFramePhase('card-actions', 'configure');
      }
      clearStagedPlay();
      return;
    }
    if (arm.flow === 'action' && arm.target.kind === 'resolution') {
      // B OUT OF A STAGED ACTION VOTE (TR15) — one level: the Parliament's frame leaves (its hosted dissolve
      // in place) and the composer it stood in — never unmounted — lets its setup come back, the variant and
      // every capture intact. Nothing was sent, so there is nothing to undo.
      if (workspaceStackTop()?.kind === 'parliament' && workspaceFrameHost('parliament') === 'card-actions') {
        popWorkspaceFrame();
      }
      clearStagedPlay();
      return;
    }
    if (arm.flow === 'action') {
      // The Action Center comes back to the very composer the player left:
      // the resumed frames remount the workspace, the restore plan seats the
      // composer from `stagedReturn`, and the composer re-applies its own
      // capture snapshot (one-shot).
      if (arm.actionRestore !== undefined) {
        consoleCardActionsUi.stagedReturn = arm.actionRestore;
      }
      if (arm.yieldedStack) {
        resumeStackFromBoard();
      }
      clearStagedPlay();
      return;
    }
    if (arm.target.kind === 'resolution' || arm.target.kind === 'colony') {
      // B OUT OF A STAGED STEP — one level: the step's frame leaves (the
      // Parliament's hosted dissolve; the colonies' own leave) and the
      // composer comes back into the same zone from the parked draft, payment
      // and focus intact. Nothing was sent, so there is nothing to undo.
      const step = arm.target.kind === 'resolution' ? 'parliament' : 'colonies';
      if (workspaceStackTop()?.kind === step && workspaceFrameHost(step) === 'hand') {
        popWorkspaceFrame();
      }
      if (step === 'colonies') {
        closeColonyFocus();
        clearColonyTrackMove();
      }
      setPlayComposerStagedDraft(arm.draft);
      setWorkspaceFramePhase('hand', 'configure');
      shell.pendingPlayCard = arm.pending;
      clearStagedPlay();
      return;
    }
    setPlayComposerStagedDraft(arm.draft);
    if (arm.yieldedStack) {
      resumeStackFromBoard();
      setWorkspaceFramePhase('hand', 'configure');
    }
    shell.pendingPlayCard = arm.pending;
    clearStagedPlay();
  }

  /**
   * The world moved under a STAGED (unsent) play — its preview is void.
   * Two honest cases: our own commit's answer already put the card on the
   * table (a lost-response retry hit STALE_PROMPT and the forced update
   * brought the truth) → the play IS made, finalize on the spot; anything
   * else → cancel back to the composer, which re-fetches its preview
   * against the new state.
   */
  function reconcileStagedPlayWorldMove(): void {
    const arm = stagedPlayState.arm;
    if (arm === undefined) {
      return;
    }
    // The tableau-membership witness works for a PLAY only — an action's
    // card is in the tableau the whole time, so for the action flow ANY
    // out-of-band world move voids the staged preview and returns the
    // player to the composer (which re-fetches against the new state).
    const played = arm.flow !== 'action' &&
      shell.playerView.thisPlayer.tableau.some((c) => c.name === arm.cardName);
    if (played) {
      discardYieldedStack();
      if (arm.flow === 'law') {
        endLawPlayLanding();
        clearLawPlayDraft();
      }
      if (!workspaceFrameKnown('card-actions')) {
        consoleCardActionsUi.draft = undefined;
      }
      clearStagedPlay();
      return;
    }
    cancelStagedPlay();
    shell.showNotice('Game state changed');
  }

  return {
    stagedBackOwed,
    stagedLandingInFlight,
    stagedPlayPrompt,
    stagedPlayLevelPrompt,
    stagedHandCard,
    beginStagedPlayLanding,
    commitStagedTail,
    onStagedPlaySpacePicked,
    beginStagedLawLanding,
    stagedBackOwedNow,
    stagedBackOwable,
    stagedHandoffHolding,
    runOwedStagedBack,
    cancelStagedPlay,
    reconcileStagedPlayWorldMove,
  };
}

export type StagedController = ReturnType<typeof createStagedController>;
