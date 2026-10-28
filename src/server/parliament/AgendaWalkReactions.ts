/*
 * THE TABLE ANSWERS A WALK OF THE CAREER (Turmoil Redux — TR78 Arwind Inc.:
 * «whenever you advance your Agenda marker 1 step, add 1 fighter to ANY card»).
 *
 * The walk of the Agenda track is ONE function (`ChairmanSeat.walkAgenda`) and
 * it calls `ICard.onAgendaWalked` ONCE per walk, after the last step's bonus;
 * a hook that answers with units onto the table answers it HERE, so the four
 * engines of the walk get the same answer and the same honesty for free:
 *
 *  · THE STEPS OF ONE WALK ARE ONE ANSWER (the owner, 2026-10-28): N steps →
 *    N units, laid out in ONE question — the family's shared distribution
 *    (`AddResourcesToCards`: N ≥ 2 over ≥ 2 holders is a LAYOUT, else the
 *    family's pick) — never N picks in a row;
 *  · THE ASKER ALONE IS NO QUESTION (the owner, 2026-10-28): when the reactor
 *    is the only holder, the units land on it at once — a fixed self-target
 *    (invariant 3's exemption), told by the console's reaction scene, never a
 *    press on the one card the player could choose. A question stands only
 *    with a CHOICE (a second holder of the kind);
 *  · the question is named by its asker (`cause`) and stamped with the walk
 *    that asked (`agendaWalkPrompt` — on the pick and on the layout alike): the
 *    console hosts it by that marker — the play's composer for a card's walk
 *    (ONE pre-collected table question), the Parliament's answer stage for the
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
 * on from the answer — the units land BEFORE the support and the enactment
 * (RX40 Sponsored Projects counts «cards with resources»: the order is seen).
 */
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {ICard, AgendaWalkContext} from '../cards/ICard';
import {CardType} from '../../common/cards/CardType';
import {CardResource} from '../../common/CardResource';
import {CardName} from '../../common/cards/CardName';
import {AgendaWalkPromptMeta} from '../../common/models/PlayerInputModel';
import {AddResourcesToCards} from '../deferredActions/AddResourcesToCards';
import {SimpleDeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import type {Parliament} from './Parliament';
import {SerializedPendingAction} from './SerializedParliament';

type CardReaction = Extract<SerializedPendingAction, {kind: 'card-reaction'}>;

/** The marker of the question `card` asks for `walk` — which reactor, which walk. */
export function agendaWalkMeta(card: CardName, walk: AgendaWalkContext): AgendaWalkPromptMeta {
  const cause = walk.cause;
  return {
    source: card,
    reason: cause.reason,
    from: walk.from,
    to: walk.to,
    ...(cause.reason === 'card' ? {card: cause.card} : {}),
    ...(cause.reason === 'resolution' ? {resolution: cause.resolution} : {}),
  };
}

/**
 * THE ONE BUILDER of the reaction's question — read by the live hook (deferred) and by the reactor's forecast (the
 * composer's pre-collected table question). The family's shared step decides the SHAPE by the numbers: `count` ≥ 2
 * over ≥ 2 holders is the distribution (a layout over the holders, the sum exactly `count`), anything else the pick;
 * `autoSelect: false` keeps a lone FOREIGN holder a shown pick of one. `cardBeingPlayed` is the forecast's: the card
 * about to enter play is a holder too.
 */
export function reactionStep(
  player: IPlayer, reactor: ICard, resource: CardResource, count: number, meta: AgendaWalkPromptMeta,
  options: {cardBeingPlayed?: ICard} = {}): AddResourcesToCards {
  return new AddResourcesToCards(player, resource, count, {
    autoSelect: false,
    cause: {kind: reactor.type === CardType.CORPORATION ? 'corporation' : 'card', card: reactor.name},
    agendaWalk: meta,
    ...(options.cardBeingPlayed !== undefined ? {cardBeingPlayed: options.cardBeingPlayed} : {}),
  });
}

/** What the answer did: the units LANDED on the asker itself, a QUESTION was raised, or the loss was NAMED (no holder). */
export type AgendaWalkAnswer = 'landed' | 'asked' | 'skipped';

/** Is `holders` exactly the asker — the fixed self-target that is no question? */
export function askerAlone(reactor: ICard, holders: ReadonlyArray<ICard>): boolean {
  return holders.length === 1 && holders[0].name === reactor.name;
}

/**
 * ANSWER the walk with `perStep` × `resource` per step taken, onto any card of the walker's table. Called from inside
 * the card's `onAgendaWalked` (the effect scope stands — the landing and the question alike join the corporation's own
 * record: the console plays the record, the journal shows the corporation's chip).
 */
export function answerResourceOnAgendaWalk(player: IPlayer, reactor: ICard, walk: AgendaWalkContext, resource: CardResource, perStep: number): AgendaWalkAnswer {
  const count = walk.steps.length * perStep;
  if (count <= 0) {
    return 'skipped';
  }
  const meta = agendaWalkMeta(reactor.name, walk);
  const step = reactionStep(player, reactor, resource, count, meta);
  const holders = step.getCards();
  if (holders.length === 0) {
    // No holder: the shared step names the loss itself (`recordSkippedEffect`) — never a silent no-op.
    step.execute();
    return 'skipped';
  }
  if (askerAlone(reactor, holders)) {
    // THE ASKER ALONE IS NO QUESTION: the units land here, now — the reaction scene tells it on the card.
    player.addResourceTo(reactor, {qty: count, log: true});
    return 'landed';
  }
  const parliament = player.game.parliament;
  const cause = walk.cause;
  if (cause.reason === 'card' || parliament === undefined) {
    // The card's own walk: one request plays it and asks — the engine's class, no record.
    player.game.defer(step);
    return 'asked';
  }
  const pending: CardReaction = {
    kind: 'card-reaction',
    player: player.id,
    card: reactor.name,
    resource,
    count,
    reason: cause.reason,
    from: walk.from,
    to: walk.to,
    ...(cause.reason === 'resolution' ? {resolution: cause.resolution} : {}),
  };
  parliament.pendingActions.push(pending);
  deferRecorded(player, parliament, pending);
  return 'asked';
}

/** Is a reaction of `player` to a walk of the Career still unanswered (any walk, or the walk `reason` only)? */
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
    const meta: AgendaWalkPromptMeta = {
      source: pending.card,
      reason: pending.reason,
      from: pending.from,
      to: pending.to,
      ...(pending.resolution !== undefined ? {resolution: pending.resolution} : {}),
    };
    const step = reactionStep(player, reactor, pending.resource, pending.count, meta).andThen(drop);
    const holders = step.getCards();
    if (holders.length === 0) {
      // No holder any more: the shared step names the loss itself (`recordSkippedEffect`) — the record goes with it.
      drop();
    } else if (askerAlone(reactor, holders)) {
      // The other holder left the table between the question and the answer: the fixed self-target lands, as it
      // would have without the question (never a pick of the one card the player cannot but choose).
      drop();
      player.addResourceTo(reactor, {qty: pending.count, log: true});
      return undefined;
    }
    return step.execute();
  }, Priority.GAIN_RESOURCE_OR_PRODUCTION));
}
