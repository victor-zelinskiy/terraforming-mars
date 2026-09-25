/*
 * THE COMMIT OF A RESOLUTION ACTION (Turmoil Redux) — the party action's twin
 * (`runPartyAction` in `parties/PartyEffects.ts`), one funnel for every action
 * an enacted resolution grants (Open IP Trade first): opens the action's root
 * scope under the RESOLUTION's own source (so every mutation inside — the
 * discard, the M€, the draw — carries the law as its cause: the journal chip,
 * the notification's «why», the draw reveal's attribution, the chairman
 * quest's «never under a resolution» rule), logs the header, RECORDS THE USE
 * (at the commit, never at the prompt's issue — a prompt built and never
 * answered spends nothing), runs the mutation.
 */
import {IPlayer} from '../../IPlayer';
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {EventSource} from '../../../common/events/EventSource';
import type {Parliament} from '../Parliament';

/** The scope every mutation of a resolution action runs under — WHOSE seat used WHICH law. */
export function resolutionActionSource(resolution: ResolutionId, player: IPlayer): EventSource {
  return {kind: 'resolution', id: resolution, owner: player.color};
}

/**
 * `mutate`'s own return value comes back out: an action whose work ENDS in the
 * commit returns nothing (Open IP Trade), while an action that hands the seat
 * a FOLLOW-UP prompt returns it (R&D Funding's copied card action asks its own
 * questions) — the prompt is built inside the scope on purpose, so the copied
 * action's stamp rides it.
 */
export function runResolutionAction<T>(player: IPlayer, parliament: Parliament, resolution: ResolutionId, mutate: () => T): T {
  const events = player.game.events;
  events.beginAction(player, resolutionActionSource(resolution, player), {category: 'parliament'});
  try {
    player.game.log('${0} used the action of ${1}', (b) => b.player(player).resolution(resolution));
    parliament.recordResolutionActionUse(player);
    return mutate();
  } finally {
    events.endScope();
  }
}
