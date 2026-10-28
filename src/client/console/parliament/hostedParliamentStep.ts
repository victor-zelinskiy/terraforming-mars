/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A HOSTED PARLIAMENT STEP — the ONE pair of questions the shell asks about
 * the two outcomes a card's play can owe the Parliament to show (Turmoil
 * Redux): «КАРЬЕРА», a walk of the Agenda track (TR04, `agendaWalk.ts`) and
 * «ДЕЛЕГАТЫ», a rally of neutral delegates (TR31, `neutralRally.ts`). Both
 * follow the same five steps (promise → seed → entrance → pose → end); the
 * shell's entrance, its conclusion and its diagnostics read them through
 * these functions BY KIND, never through two copies of one branch.
 *
 * THREE HOSTS: the hand (a card played from it), a Parliament standing on its
 * own, and the START workspace — a Prelude's walk (TRP1 Lobbying Campaign) and
 * a Prelude's rally (TRP2 Unity Campaign and its sister campaigns), each played
 * in the Parliament the start hosts as a scene step.
 */
import {agendaWalkFlow, agendaWalkLiveIn, agendaWalkOwedTo, dropAgendaWalkPromise} from './agendaWalk';
import {neutralRallyFlow, neutralRallyLiveIn, neutralRallyOwedTo, dropNeutralRallyPromise} from './neutralRally';
import {workspaceFrameDescended, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';

export type HostedParliamentStepKind = 'walk' | 'rally';
export type HostedParliamentStepHost = 'hand' | 'parliament' | 'start';

/** Something a card's play owes the Parliament to show is not on screen yet (the conclusion's `owed-step`). */
export function hostedStepOwedTo(host: HostedParliamentStepHost): boolean {
  return agendaWalkOwedTo(host) || neutralRallyOwedTo(host);
}

/** A hosted outcome is PLAYING inside this workspace (the conclusion's `live-outcome`). */
export function hostedStepLiveIn(host: HostedParliamentStepHost): boolean {
  return agendaWalkLiveIn(host) || neutralRallyLiveIn(host);
}

/** The live outcome's beat, for the conclusion's diagnostics ('' when none plays). */
export function hostedStepLiveBeat(host: HostedParliamentStepHost): string {
  if (agendaWalkLiveIn(host)) {
    return `walk-live:${agendaWalkFlow.beat}`;
  }
  if (neutralRallyLiveIn(host)) {
    return `rally-live:${neutralRallyFlow.beat}`;
  }
  return '';
}

/** The play was refused, or its answer carried no record: nothing is owed by either kind. */
export function dropHostedStepPromises(): void {
  dropAgendaWalkPromise();
  dropNeutralRallyPromise();
}

/**
 * THE STEP THE HAND HAS TO ENTER NOW (the landing scene's `closing` phase): a
 * record owed to the hand, not yet live, with the hand's descent standing —
 * the walk first (a card walks OR rallies; both would be two outcomes of one
 * answer, played in the card's printed order).
 */
export function hostedStepToEnter(): HostedParliamentStepKind | undefined {
  if (!workspaceFrameDescended('hand')) {
    return undefined;
  }
  if (agendaWalkFlow.owed?.host === 'hand' && !agendaWalkFlow.live) {
    return 'walk';
  }
  if (neutralRallyFlow.owed?.host === 'hand' && !neutralRallyFlow.live) {
    return 'rally';
  }
  return undefined;
}

/**
 * THE STEP THE START HAS TO ENTER NOW: a record owed to the start, not yet live,
 * the opening standing and NO Parliament up — a walk whose Prelude's grant asked
 * nothing (TRP1 with an empty reserve: the record rode the play's own answer and
 * no vote step stands to continue in), or a campaign's rally (TRP2…: the record
 * rode the answer to the play's own colony / city, or the play itself). With a
 * vote step standing, a walk CONTINUES in place instead
 * (`ConsoleShell.onParliamentFlowComplete`). The walk first — one play owes one.
 */
export function startHostedStepToEnter(): HostedParliamentStepKind | undefined {
  if (!workspaceFrameKnown('start') || workspaceFrameKnown('parliament')) {
    return undefined;
  }
  if (agendaWalkFlow.owed?.host === 'start' && !agendaWalkFlow.live) {
    return 'walk';
  }
  return neutralRallyFlow.owed?.host === 'start' && !neutralRallyFlow.live ? 'rally' : undefined;
}
