/*
 * THE TABLE ANSWERS A STEP OF THE CAREER (Turmoil Redux — TR78 Arwind Inc.:
 * «whenever you advance your Agenda marker 1 step, add 1 fighter to ANY card»).
 *
 * The walk of the Agenda track is ONE function (`ChairmanSeat.walkAgenda`) and
 * it calls `ICard.onAgendaStep` for every step it takes; a hook that answers
 * with a QUESTION — «put N <resource> on any card» — asks it HERE, so the four
 * engines of the walk get the same question and the same honesty for free:
 *
 *  · the question is the family's ONE shared step (`AddResourcesToCard`,
 *    `autoSelect: false` — the reactor itself is a candidate and is still
 *    ASKED, never applied silently), named by its asker (`cause`) and stamped
 *    with the step that asked (`agendaStepPrompt`) — the console hosts it by
 *    that marker: the hand for a card's walk, the Parliament's stage for the
 *    sitting, the quest and a law;
 *  · the builder is ONE (`reactionStep`): the live hook defers it, the card's
 *    forecast hands the composer the SAME prompt as a pre-collected table
 *    question (`effectForecastPreviews.tableQuestion`) — never a second
 *    description;
 *  · a walk the PARLIAMENT runs (`phase` · `quest` · `resolution`) is followed
 *    by a save after every answer, and deferred actions are not serialized —
 *    so the question is RECORDED (`pendingActions` `card-reaction`) and a
 *    reload re-asks it (`rebuild`); the answer drops the record (never twice).
 *    A card's own walk (`card`) asks inside the one request that played it —
 *    the engine's class for every deferred question of a play, no record.
 *
 * The sitting waits on the question by construction: its driver drains the
 * deferred queue after the `agenda` step (`ParliamentPhase.drive`) and goes
 * on from the answer — the fighter lands BEFORE the support and the enactment
 * (RX40 Sponsored Projects counts «cards with resources»: the order is seen).
 */
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {ICard, AgendaStepContext} from '../cards/ICard';
import {CardType} from '../../common/cards/CardType';
import {CardResource} from '../../common/CardResource';
import {CardName} from '../../common/cards/CardName';
import {AgendaStepPromptMeta} from '../../common/models/PlayerInputModel';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {SimpleDeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import type {Parliament} from './Parliament';
import {SerializedPendingAction} from './SerializedParliament';

type CardReaction = Extract<SerializedPendingAction, {kind: 'card-reaction'}>;

/** The marker of the question `card` asks for `step` — which reactor, which walk, which step. */
export function agendaStepMeta(card: CardName, step: AgendaStepContext): AgendaStepPromptMeta {
  const cause = step.cause;
  return {
    source: card,
    reason: cause.reason,
    step: step.to,
    index: step.index,
    of: step.of,
    ...(cause.reason === 'card' ? {card: cause.card} : {}),
    ...(cause.reason === 'resolution' ? {resolution: cause.resolution} : {}),
  };
}

/**
 * THE ONE BUILDER of the reaction's question — read by the live hook (deferred) and by the reactor's forecast (the
 * composer's pre-collected table question). `cardBeingPlayed` is the forecast's: the card about to enter play is a
 * holder too (`AddResourcesToCard.Options.cardBeingPlayed`).
 */
export function reactionStep(
  player: IPlayer, reactor: ICard, resource: CardResource, count: number, meta: AgendaStepPromptMeta,
  options: {cardBeingPlayed?: ICard} = {}): AddResourcesToCard {
  return new AddResourcesToCard(player, resource, {
    count,
    autoSelect: false,
    cause: {kind: reactor.type === CardType.CORPORATION ? 'corporation' : 'card', card: reactor.name},
    agendaStep: meta,
    ...(options.cardBeingPlayed !== undefined ? {cardBeingPlayed: options.cardBeingPlayed} : {}),
  });
}

/**
 * ASK the reaction of `reactor` to one step of the walk: `count` × `resource` onto any card of the walker's table.
 * Called from inside the card's `onAgendaStep` (the effect scope stands — the question is deferred in it, so the
 * answer joins the corporation's own chip in the journal).
 */
export function askResourceOnAgendaStep(player: IPlayer, reactor: ICard, step: AgendaStepContext, resource: CardResource, count: number): void {
  const meta = agendaStepMeta(reactor.name, step);
  const parliament = player.game.parliament;
  const cause = step.cause;
  if (cause.reason === 'card' || parliament === undefined) {
    // The card's own walk: one request plays it and asks — the engine's class, no record.
    player.game.defer(reactionStep(player, reactor, resource, count, meta));
    return;
  }
  const pending: CardReaction = {
    kind: 'card-reaction',
    player: player.id,
    card: reactor.name,
    resource,
    count,
    reason: cause.reason,
    step: step.to,
    index: step.index,
    of: step.of,
    ...(cause.reason === 'resolution' ? {resolution: cause.resolution} : {}),
  };
  parliament.pendingActions.push(pending);
  deferRecorded(player, parliament, pending);
}

/** Is a reaction of `player` to a step of the Career still unanswered (any walk, or the walk `reason` only)? */
export function agendaReactionPending(parliament: Parliament, player?: IPlayer, reason?: CardReaction['reason']): CardReaction | undefined {
  for (const action of parliament.pendingActions) {
    if (action.kind === 'card-reaction' && (player === undefined || action.player === player.id) && (reason === undefined || action.reason === reason)) {
      return action;
    }
  }
  return undefined;
}

/** Re-ask every recorded reaction after a reload (deferred actions are not serialized; the records are). */
export function rebuildAgendaReactions(game: IGame, parliament: Parliament): void {
  for (const pending of parliament.pendingActions) {
    if (pending.kind !== 'card-reaction') {
      continue;
    }
    deferRecorded(game.getPlayerById(pending.player), parliament, pending);
  }
}

function deferRecorded(player: IPlayer, parliament: Parliament, pending: CardReaction): void {
  const drop = () => {
    parliament.pendingActions = parliament.pendingActions.filter((action) => action !== pending);
  };
  player.game.defer(new SimpleDeferredAction(player, () => {
    if (!parliament.pendingActions.includes(pending)) {
      // Answered already (a doubled defer, a resume that raced the answer): answering twice is not expressible.
      return undefined;
    }
    const reactor = player.tableau.get(pending.card);
    if (reactor === undefined) {
      // The reactor left the table (no road does it today): the question has nobody to ask for.
      drop();
      return undefined;
    }
    const meta: AgendaStepPromptMeta = {
      source: pending.card,
      reason: pending.reason,
      step: pending.step,
      index: pending.index,
      of: pending.of,
      ...(pending.resolution !== undefined ? {resolution: pending.resolution} : {}),
    };
    const step = reactionStep(player, reactor, pending.resource, pending.count, meta).andThen(drop);
    if (step.getCards().length === 0) {
      // No holder: the shared step names the loss itself (`recordSkippedEffect`) — the record goes with it.
      drop();
    }
    return step.execute();
  }, Priority.GAIN_RESOURCE_OR_PRODUCTION));
}
