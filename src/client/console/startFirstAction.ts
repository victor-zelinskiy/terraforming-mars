/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * FIRST-ACTION STAGE MODEL — the pure derivations of the Game Start
 * Workspace's conditional «ПЕРВОЕ ДЕЙСТВИЕ» stage (the corporation's
 * mandatory first action, embedded into the start flow after the preludes).
 *
 * Everything here is PURE over the PlayerViewModel + the server's own
 * artifacts (the `corporationInitialAction` OrOptions marker,
 * `pendingInitialActions`, the `/api/corp-first-action-preview` ActionPreview)
 * — never a corporation-name table, never re-derived game rules. The scene
 * performs; this module answers.
 *
 * Unit-tested under the server runner:
 * tests/client/components/console/startFirstAction.spec.ts
 */
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {
  corpActionOptionIndexFor,
  startFlowCorpPrompt,
} from '@/client/components/startGameFlow/startGameFlowState';
import {isActionMenuTitle} from '@/common/inputs/actionMenuTitles';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus} from '@/client/components/overview/playerStatusPresenter';
import {Color} from '@/common/Color';

/**
 * The corporation STILL OWES its mandatory first action — the stage's
 * existence condition. Domain-state only: `pendingInitialActions` is the
 * server's own ledger (filled when the corporation is played, drained when
 * the action option is taken), and the live prompt covers the last beat
 * where the ledger has already drained inside the same response.
 */
export function firstActionOwed(view: PlayerViewModel): boolean {
  return (view.pendingInitialActions ?? []).length > 0 ||
    startFlowCorpPrompt(view) !== undefined;
}

/**
 * THE PREVIOUS STAGE HAS NOT FINISHED — the viewer is still being asked
 * something that is not this stage's own move.
 *
 * A DEPLOYMENT IS A SEQUENCE, and the general form of «the next stage may not
 * start yet» is not a list of the shapes the previous one can be in — it is the
 * server's own one-question-at-a-time contract. Exactly one prompt stands for a
 * player at a time, so «a prompt is up and it is not the corporation's first
 * action» IS «the work before this stage is still owed», whatever produced it.
 *
 * The enumerated blockers the stage used to rely on (the prelude prompt, the
 * candidate pick, the hero, the queue, an embedded step…) are all TRUE and all
 * still checked — but they can only ever cover the chains somebody thought of.
 * «Эпатажный спонсор» → «Деловые контакты» produces a deck PICK, which is none
 * of them: the stage walked in on top of the four cards the player was choosing
 * between, in its own «wait for your turn» pose, and there was no way back to
 * them.
 *
 * `allowActionMenu` is the difference between the stage's two edges. For ENTRY
 * the menu is NOT quiet: the start is still running and a menu there is a bonus
 * window the workspace serves through its own stage. For LEAVE it is the honest
 * end — the game proper has begun, and holding the stage for it would strand
 * the workspace forever. Matching the menu is the ONE sanctioned title check
 * (`actionMenuTitles.ts`: the server SETS the title from these plain-string
 * constants and the client DETECTS it from the same module, so i18n never
 * rewrites it).
 */
export function startFlowOtherPromptStands(
  view: PlayerViewModel,
  opts: {allowActionMenu?: boolean} = {},
): boolean {
  const wf = view.waitingFor;
  if (wf === undefined) {
    return false;
  }
  if (startFlowCorpPrompt(view) !== undefined) {
    return false;
  }
  if (opts.allowActionMenu === true) {
    const title = wf.title;
    return !isActionMenuTitle(typeof title === 'string' ? title : title?.message);
  }
  return true;
}

/**
 * The corporation the stage puts on its seat RIGHT NOW. With several owed
 * (Merger) the one whose option is LIVE leads; the rest follow one at a time
 * as the server re-raises the prompt.
 */
export function firstActionStageCorp(view: PlayerViewModel): CardName | undefined {
  const pending = view.pendingInitialActions ?? [];
  const prompt = startFlowCorpPrompt(view);
  if (prompt !== undefined) {
    const ready = pending.find((name) => corpActionOptionIndexFor(prompt, name) !== -1);
    if (ready !== undefined) {
      return ready;
    }
  }
  return pending[0];
}

/**
 * The stage is ACTIONABLE — the player's turn has genuinely arrived: the
 * marked OrOptions is live and carries this corp's option. Everything else
 * (the opponent still moving, the prompt held behind a cinematic) is the
 * waiting state.
 */
export function firstActionActionable(view: PlayerViewModel, corp: CardName | undefined): boolean {
  if (corp === undefined) {
    return false;
  }
  return corpActionOptionIndexFor(startFlowCorpPrompt(view), corp) !== -1;
}

/**
 * The printed first-action ASK — the live option's buttonLabel (the server's
 * `initialActionText`, structural, translation-proof). `undefined` while the
 * prompt has not arrived: the caller shows the honest generic then.
 */
export function firstActionAsk(view: PlayerViewModel, corp: CardName | undefined): string | undefined {
  const prompt = startFlowCorpPrompt(view);
  if (prompt === undefined || corp === undefined) {
    return undefined;
  }
  const index = corpActionOptionIndexFor(prompt, corp);
  const label = index !== -1 ? prompt.options?.[index]?.buttonLabel : undefined;
  return label !== undefined && label !== '' ? label : undefined;
}

/** The branch the briefing presents — the available one, else the first
 *  (the same rule the play composer follows). */
export function firstActionBranch(preview: ActionPreview | undefined): ActionPreviewBranch | undefined {
  return preview?.branches.find((b) => b.available) ?? preview?.branches[0];
}

/**
 * How many cards this first action DRAWS — the same structural read the
 * ceremony's play path uses (`prefetchPlayRewards`): a `cards` gain in the
 * branch means the follow-up reveal will be claimed into the workspace's own
 * embed zone at press time.
 */
export function firstActionDrawExpected(preview: ActionPreview | undefined): number {
  const branch = firstActionBranch(preview);
  if (branch === undefined) {
    return 0;
  }
  let expected = 0;
  for (const e of branch.effects ?? []) {
    if (e.direction === 'gain' && e.icon === 'cards') {
      expected += Math.max(1, Math.round(e.amount));
    }
  }
  return expected;
}

/** One seat of the waiting readout — whose move we are waiting out. */
export type FirstActionWaitMate = {
  color: Color,
  /** RAW model name — the view resolves it (participantDisplayName). */
  name: string,
  isMarsBot: boolean,
};

/**
 * WHOSE TURN ARE WE ACTUALLY WAITING FOR — the first OTHER player the shared
 * status brain classifies as ACTIVE (the same `actionLabelForPlayer` +
 * `presentPlayerStatus` pair the top strip and the start summary read, so no
 * surface can disagree with the chip row about who is moving).
 * `undefined` when nobody else is active — i.e. we are waiting for NOBODY.
 *
 * That `undefined` is load-bearing, and it is why this is not a first-action
 * detail: «ожидаем других игроков» is a CLAIM ABOUT OTHER PLAYERS, and the
 * deployment's status rail used to print it as a blanket fallback whenever it
 * had no focused card — in a solo game against MarsBot, mid-transition,
 * waiting for nobody at all. A line that names a wait must be able to name
 * WHO, or it must say nothing.
 */
export function startWaitMate(
  view: PlayerViewModel,
  livePlayersWaitingFor?: ReadonlyArray<Color>,
): FirstActionWaitMate | undefined {
  const viewer = view.thisPlayer.color;
  const live = liveWaitingSignal(livePlayersWaitingFor);
  for (const player of view.players) {
    if (player.color === viewer) {
      continue;
    }
    const isMarsBot = player.isMarsBot === true;
    const status = presentPlayerStatus(actionLabelForPlayer(view, player, live), isMarsBot);
    if (status.category === 'active') {
      return {color: player.color, name: player.name, isMarsBot};
    }
  }
  return undefined;
}
