/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHERE A CARD PLAY'S FOLLOW-UP PRESENTS — the ONE resolver, for every door a
 * card can be played from.
 *
 * THE RULE (project NORTH STAR, `.claude/rules/console-ui.md` § EMBEDDED
 * OUTCOMES): the player entered a workspace, picked a card up in it and played
 * it there, so everything that play produces — the cards it draws, the pick it
 * raises — belongs to THAT workspace and is presented inside it. The workspace
 * does not leave until the player has taken all of it.
 *
 * WHY A RESOLVER AND NOT A CLAIM AT EACH DOOR. A card can be played from three
 * places, and each of them used to answer the question differently:
 *
 *   · «КАРТЫ В РУКЕ» (the play composer descended into the hand's stage) —
 *     answered NOTHING: no claim existed at all, so a card that drew cards let
 *     its workspace dissolve on the landing beat and the batch then arrived as
 *     a full-bleed reveal over the board, physically dealt from the deck to
 *     nowhere in particular. The player pressed «Разыграть» inside a screen and
 *     the result of that press appeared somewhere else.
 *   · the GAME START WORKSPACE's queue (a corporation / a prelude) — answered
 *     «only if the preview PROMISED cards», which is a hint and not a fact:
 *     Point Luna draws from a triggered EFFECT (`onCardPlayed`), which no
 *     `behavior` preview can advertise, so its own opening draw escaped to the
 *     fullscreen viewer as though it had come off the board.
 *   · the standalone `playFromHand` band (no workspace behind it) — correctly
 *     answered «nobody», and still does.
 *
 * So the question is asked ONCE, structurally (which workspace is the play
 * standing in?), and the claim is OPTIMISTIC: a play that turns out to produce
 * nothing embeddable is reconciled away a tick after the response
 * (`reconcileWorkspaceOutcome`), which is strictly safer than guessing from a
 * preview and missing.
 *
 * PURE-ish: reads the workspace stack, writes the claim. No DOM, no Vue
 * components, no i18n.
 */
import {
  WorkspaceOutcomeHost,
  WorkspaceOutcomeKind,
  claimWorkspaceOutcome,
  rehomeWorkspaceOutcome,
  setWorkspaceOutcomeSlot,
} from '@/client/console/consoleWorkspaceOutcome';
import {
  workspaceFrameDescended,
  workspaceFrameMounted,
} from '@/client/console/consoleWorkspaceStack';
import {playedHeroLandingPrewarm, playedHeroLandingUp} from '@/client/console/played/consolePlayedHero';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {deckDrawDealing} from '@/client/console/deckDraw/consoleDeckDraw';
import {nextTick, reactive} from 'vue';

/** The landing scene's EXIT window — see `playLandingReleasing`. */
const landingRelease = reactive({releasing: false});

/**
 * The exit's backstop. Far above the dissolve itself (~240 ms), far below
 * anything the player would notice as a stuck stage.
 */
const LANDING_RELEASE_SAFETY_MS = 1_200;

let releaseBackstop: ReturnType<typeof setTimeout> | undefined;

function clearReleaseBackstop(): void {
  if (releaseBackstop !== undefined) {
    clearTimeout(releaseBackstop);
    releaseBackstop = undefined;
  }
}

/**
 * A workspace a card can be PLAYED inside, and the zone it publishes for what
 * the play produces.
 *
 * DEEPEST FIRST. The hand can stand INSIDE the start workspace (the sponsor's
 * play-from-hand prelude), and there the play belongs to the hand step — the
 * same «nearest live unfinished step» law `workspaceHostForStep` states for
 * frames.
 */
type PlayOutcomeHostSpec = {
  host: WorkspaceOutcomeHost,
  /** The teleport target for the reveal / the pick this play produces. */
  zone: string,
  /**
   * Does this host need to be IN A FLOW (descended) to own a play?
   *
   * The hand does: its zone IS the card-play stage, and at the browse layer
   * there is no play to be the follow-up of. The start workspace does not —
   * its queue press IS the flow.
   */
  inFlowOnly: boolean,
};

const PLAY_OUTCOME_HOSTS: ReadonlyArray<PlayOutcomeHostSpec> = [
  {host: 'hand', zone: '[data-embed-slot="hand-outcome"]', inFlowOnly: true},
  {host: 'start', zone: '.con-start__embed', inFlowOnly: false},
];

/**
 * WHICH WORKSPACE HOSTS THE PLAY THE PLAYER IS MAKING RIGHT NOW — or undefined
 * when they are not inside one (the standalone band, where a full-bleed result
 * is the honest presentation because there is no parent surface to be inside).
 */
export function playOutcomeHost(): PlayOutcomeHostSpec | undefined {
  return PLAY_OUTCOME_HOSTS.find((spec) => spec.inFlowOnly ?
    workspaceFrameDescended(spec.host) :
    workspaceFrameMounted(spec.host));
}

/**
 * THE STEP IS OVER, THE FLOW IS NOT — hand this play's outcome UP to the
 * workspace that was hosting the step, and answer whether anybody took it.
 *
 * The hand can stand INSIDE the start workspace («Эпатажный спонсор»), and its
 * ONLY purpose there is the play: the step unmounts as soon as the card lands,
 * which is several beats before the play's own follow-up exists. Releasing the
 * claim on that unmount left the pick «Деловые контакты» raises with no owner
 * at all — a standalone «ДОБОР КАРТ» band over a start workspace that had
 * never gone anywhere, and a deployment that then advanced its own stage on
 * top of it because nothing said a step was still owed.
 *
 * So the same table answers the exit: skip the host that is leaving, take the
 * next one still live. `undefined` when there is none — the play really did
 * end with the step, and the caller releases as before.
 */
export function rehomePlayOutcome(leaving: WorkspaceOutcomeHost): boolean {
  const spec = PLAY_OUTCOME_HOSTS.find((candidate) => candidate.host !== leaving && (candidate.inFlowOnly ?
    workspaceFrameDescended(candidate.host) :
    workspaceFrameMounted(candidate.host)));
  if (spec === undefined) {
    return false;
  }
  // THE ZONE IS PUBLISHED A TICK LATE, AND THAT IS THE POINT. The new host's
  // zone does not exist yet: the step is unmounting in this very patch, and the
  // surfaces it was covering re-render as part of it — while a `<Teleport>` in
  // the SHELL is patched BEFORE its child scene renders them. Named here and
  // now, the target does not resolve and Vue leaves the content where it stands
  // (measured: the pick rendered as a bare full-viewport child of `.con-root`,
  // stripped of its own chrome because it believed it was embedded).
  //
  // An empty slot is the console's own «claimed but not ready» state, which
  // renders the surface NOWHERE for the gap frame — never in a band of its own
  // for one frame and then somewhere else.
  rehomeWorkspaceOutcome(spec.host, '');
  void nextTick(() => {
    if (workspaceOutcomeState.host === spec.host && workspaceOutcomeState.sourceCard !== '') {
      setWorkspaceOutcomeSlot(spec.zone);
    }
  });
  return true;
}

/**
 * THE OUTCOME HAS TAKEN THE STAGE — the play's next surface is on it (or its
 * cards are visibly on their way), so the tableau that told the CAUSE has to
 * make room for the one telling the CONSEQUENCE.
 *
 * TWO signals, deliberately, because a play's outcome comes in two shapes and
 * only one of them is a deal. Cards coming off the deck announce themselves
 * long before the reveal assembles, so `deckDrawDealing()` is the earliest
 * honest moment there; an outcome with no cards at all (the effect decision
 * «Марсианский университет» raises, a buy prompt) has no deal to watch and
 * announces itself by PRESENTING — the claimed surface is in the workspace's
 * zone, standing over this very tableau.
 *
 * Keyed on the deal alone, that second shape never let go: the settled tableau
 * stayed underneath the arriving decision for the rest of the flow, and the
 * only thing that removed it was its own component being torn out — a cut, in
 * the one place this module exists to make a dissolve.
 */
function outcomeTookTheStage(): boolean {
  return deckDrawDealing() || workspaceOutcomeState.stage === 'presenting';
}

/**
 * IS THE LANDING SCENE STILL THE WORKSPACE'S CONTENT?
 *
 * The played-hero transaction ends when the card has landed and its rewards
 * have resolved — but what the play DREW has not even started coming off the
 * deck at that moment (the deck cinematic waits for the hero, by design: one
 * scene tells the cause, the next the consequence). Keyed on the transaction
 * alone, the settled tableau vanished the instant it finished and the
 * workspace stood EMPTY for that whole gap.
 *
 * So the landing scene stays until the outcome ACTUALLY TAKES THE STAGE — and
 * then it lets go, because from that moment the stage belongs to what is
 * arriving: a tableau still standing there is the previous beat refusing to
 * end. It goes with a dissolve, never a cut (`playLandingReleasing`).
 *
 * The PREWARM window is excluded on purpose: at the arm the tableau is mounted
 * HIDDEN so its geometry settles during the round trip, and revealing it there
 * would show the result of a move the server has not confirmed.
 */
export function playLandingHolding(): boolean {
  if (playedHeroLandingUp()) {
    return true; // the hero's own scene — it owns the stage outright
  }
  return workspaceOutcomeState.host === 'hand' && workspaceOutcomeState.sourceCard !== '' &&
    !playedHeroLandingPrewarm() && !outcomeTookTheStage();
}

/**
 * DID THE LANDING LET GO BECAUSE THE OUTCOME ARRIVED?
 *
 * The scene's hold can fall for two opposite reasons, and they need opposite
 * answers: the OUTCOME is an exit (the stage dissolves and the released setup
 * stays released — the play happened), a REFUSAL is a rollback (the setup
 * comes back with every capture intact). This is the positive fact for the
 * first one, so neither has to be inferred from the absence of the other.
 */
export function playLandingYieldedToOutcome(): boolean {
  return workspaceOutcomeState.host === 'hand' && workspaceOutcomeState.sourceCard !== '' &&
    outcomeTookTheStage();
}

/**
 * THE LANDING SCENE IS DISSOLVING — it has let go (the deal began) but its
 * exit is still playing, so it must stay MOUNTED and FROZEN for exactly that
 * long. Without the second half a dissolve is unexpressible: the `v-if` that
 * mounts the scene is derived from the same fact that ends it, so dropping
 * that fact would tear the element out mid-fade — the cut this replaces.
 */
export function playLandingReleasing(): boolean {
  return landingRelease.releasing;
}

/** The scene is on screen — holding OR still dissolving. Every consumer that
 *  renders it (the layer's mount, its `--up` pose, the stage's own content)
 *  reads THIS, so the exit animates instead of blinking out. */
export function playLandingShowing(): boolean {
  return playLandingHolding() || landingRelease.releasing;
}

/**
 * Begin the exit. Called SYNCHRONOUSLY by the component that owns the layer,
 * from a pre-flush watcher on the holding fact — so the render that follows
 * already knows to keep the element mounted.
 *
 * The backstop is not the schedule: it covers a dissolve that never reports
 * (the workspace closed under it, a killed timeline), because a stuck flag
 * would keep the NEXT play's stage mounted from its first frame.
 */
export function beginPlayLandingRelease(): void {
  landingRelease.releasing = true;
  clearReleaseBackstop();
  if (typeof setTimeout === 'function') {
    releaseBackstop = setTimeout(() => markPlayLandingReleased(), LANDING_RELEASE_SAFETY_MS);
  }
}

/** The dissolve finished (or was never possible) — the layer may go. */
export function markPlayLandingReleased(): void {
  clearReleaseBackstop();
  landingRelease.releasing = false;
}

/**
 * IS THIS CLAIM A CARD PLAY'S — i.e. one placed OPTIMISTICALLY?
 *
 * The other hosts claim on structural evidence (a colony that deals cards, an
 * action whose preview promised them), so «nothing arrived» is a genuine
 * surprise there. A play claims before knowing, deliberately, and therefore
 * owes the other half of that bargain: it must be settled against the response
 * (`reconcileWorkspaceOutcome`) instead of expiring on the 20 s backstop with
 * its workspace unable to conclude.
 */
export function isPlayOutcomeHost(host: WorkspaceOutcomeHost | undefined): boolean {
  return host !== undefined && PLAY_OUTCOME_HOSTS.some((spec) => spec.host === host);
}

/**
 * CLAIM whatever this play sets off, in the same press as the submit — before
 * the response can land, so nothing card-shaped can slip past and open a
 * standalone surface for a frame.
 *
 * `expectedCards` is the preview's `cards` hint when there is one: it sizes a
 * prepared arrival, it never decides whether to claim. Returns the host that
 * took it (undefined = no workspace behind this play — nothing is claimed and
 * the standalone presenters keep their artifact, exactly as before).
 *
 * `deckCheck` is the one kind that is NOT claimed optimistically. A verdict is
 * produced by an ACTION, and a play only reaches one by REPEATING it (Project
 * Inspection), which the composed repeat descriptor states structurally — the
 * same «kinds come from the preview branch, never from the card's identity»
 * rule the direct activation follows. Claiming it for every play would put a
 * workspace's name on a verdict it had no part in.
 *
 * `effect` IS claimed for every play, and for the same reason `draw` and `pick`
 * are: a TRIGGERED effect is invisible to every preview («Марсианский
 * университет» answers a science tag played on a card that knows nothing about
 * it), so «claim, and release what turns out not to be ours» is the only way to
 * catch it at all. The reconciler settles it against the actual response.
 */
export function claimPlayOutcome(
  card: string,
  expectedCards = 0,
  opts: {deckCheck?: boolean} = {},
): WorkspaceOutcomeHost | undefined {
  const spec = playOutcomeHost();
  // A new play starts with a clean stage: an exit left hanging by a workspace
  // that closed mid-dissolve must never be inherited by the next one.
  markPlayLandingReleased();
  if (spec === undefined) {
    return undefined;
  }
  // The zone is published BEFORE the claim: a teleport whose target does not
  // exist yet drops its content on the floor, and the claim is what makes the
  // consumers start looking for it.
  setWorkspaceOutcomeSlot(spec.zone);
  const kinds: Array<WorkspaceOutcomeKind> = ['draw', 'pick', 'effect'];
  if (opts.deckCheck === true) {
    kinds.push('deck-check');
  }
  // 'chain': the play runs OTHER cards' triggered effects too, and the server
  // attributes their draws to THEM (Point Luna) — and a repeated action's
  // verdict to the card that was COPIED. Everything one press sets off is this
  // workspace's.
  claimWorkspaceOutcome(spec.host, card, kinds, 0, expectedCards, 'chain');
  return spec.host;
}
