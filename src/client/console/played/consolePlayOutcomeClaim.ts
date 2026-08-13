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
  claimWorkspaceOutcome,
  setWorkspaceOutcomeSlot,
} from '@/client/console/consoleWorkspaceOutcome';
import {
  workspaceFrameDescended,
  workspaceFrameMounted,
} from '@/client/console/consoleWorkspaceStack';
import {playedHeroLandingPrewarm, playedHeroLandingUp} from '@/client/console/played/consolePlayedHero';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';

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
 * IS THE LANDING SCENE STILL THE WORKSPACE'S CONTENT?
 *
 * The played-hero transaction ends when the card has landed and its rewards
 * have resolved — but what the play DREW is still coming off the deck at that
 * moment (the deck cinematic waits for the hero, by design: one scene tells
 * the cause, the next the consequence). Keyed on the transaction alone, the
 * settled tableau vanished the instant it finished and the workspace stood
 * EMPTY for the whole flight, then the reveal appeared into the void.
 *
 * So the landing scene stays while this workspace is still holding what its
 * play produced. It is relieved by the arriving surface itself, one flush
 * after that surface paints (`workspaceOutcomeEmbedded` clears the composer)
 * — one surface leaves as the next takes over, never a gap between them.
 *
 * The PREWARM window is excluded on purpose: at the arm the tableau is mounted
 * HIDDEN so its geometry settles during the round trip, and revealing it there
 * would show the result of a move the server has not confirmed.
 */
export function playLandingHolding(): boolean {
  return playedHeroLandingUp() ||
    (workspaceOutcomeState.host === 'hand' && workspaceOutcomeState.sourceCard !== '' &&
      !playedHeroLandingPrewarm());
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
 */
export function claimPlayOutcome(card: string, expectedCards = 0): WorkspaceOutcomeHost | undefined {
  const spec = playOutcomeHost();
  if (spec === undefined) {
    return undefined;
  }
  // The zone is published BEFORE the claim: a teleport whose target does not
  // exist yet drops its content on the floor, and the claim is what makes the
  // consumers start looking for it.
  setWorkspaceOutcomeSlot(spec.zone);
  // 'chain': the play runs OTHER cards' triggered effects too, and the server
  // attributes their draws to THEM (Point Luna). Everything one press sets off
  // is this workspace's.
  claimWorkspaceOutcome(spec.host, card, ['draw', 'pick'], 0, expectedCards, 'chain');
  return spec.host;
}
