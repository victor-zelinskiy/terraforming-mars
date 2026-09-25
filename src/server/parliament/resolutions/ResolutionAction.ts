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

export function runResolutionAction(player: IPlayer, parliament: Parliament, resolution: ResolutionId, mutate: () => void): void {
  const events = player.game.events;
  events.beginAction(player, resolutionActionSource(resolution, player), {category: 'parliament'});
  try {
    player.game.log('${0} used the action of ${1}', (b) => b.player(player).resolution(resolution));
    parliament.recordResolutionActionUse(player);
    mutate();
  } finally {
    events.endScope();
  }
}
