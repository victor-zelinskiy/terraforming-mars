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
import {Message} from '../../../common/logs/Message';
import {Payment} from '../../../common/inputs/Payment';
import {ResolutionActionPromptMeta} from '../../../common/models/PlayerInputModel';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
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

/** The BILL a paid resolution action defers — its amount for THIS seat, what may pay it, its title, the marker's seed. */
export type ResolutionActionBillRequest = {
  amount: number;
  canUseTitanium: boolean;
  title: string | Message;
  /** The action's own marker (the menu's `choose` stage) — the bill is stamped with the same seed at stage `pay`. */
  meta: ResolutionActionPromptMeta;
};

/**
 * THE COMMIT OF A PAID RESOLUTION ACTION (Trade Industries: «pay 12 M€ to
 * gain an extra trade fleet») — the same funnel, ordered PAY, THEN GAIN, the
 * way the vote from the reserve is («PAY, THEN PLACE» in `ParliamentHandler`):
 * the answer opens the action's root scope under the resolution's source and
 * DEFERS the bill inside it (the payment therefore groups under the law, its
 * M€ leaving under the `payment` source); the header, the USE and the
 * mutation all wait for the bill to be settled — a bill the player never
 * settles (a reload drops the deferred queue) spends nothing, grants nothing
 * and leaves the action offered again. The bill carries the action's marker
 * at stage `pay` (the console hosts it as the flow's next stage) and the
 * resolution as its cause. `mutate` receives what was paid.
 */
export function runPaidResolutionAction(
  player: IPlayer,
  parliament: Parliament,
  resolution: ResolutionId,
  bill: ResolutionActionBillRequest,
  mutate: (payment: Payment) => void,
): void {
  const events = player.game.events;
  events.beginAction(player, resolutionActionSource(resolution, player), {category: 'parliament'});
  try {
    player.game.defer(new SelectPaymentDeferred(player, bill.amount, {
      canUseTitanium: bill.canUseTitanium,
      title: bill.title,
      cause: {kind: 'resolution', resolution},
      resolutionAction: {...bill.meta, stage: 'pay'},
    })).andThen((payment) => {
      player.game.log('${0} used the action of ${1}', (b) => b.player(player).resolution(resolution));
      parliament.recordResolutionActionUse(player);
      mutate(payment);
    });
  } finally {
    events.endScope();
  }
}
