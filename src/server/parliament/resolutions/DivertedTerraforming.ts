/*
 * THE FAMILY'S ONE MECHANISM FOR A REPLACED TERRAFORMING UNIT (Turmoil Redux —
 * RX35 Diverted Research, the first law of the REPLACING kind): the units a law
 * takes out of ONE operation are gathered here, and the player is asked ONCE
 * where their data goes (the owner's decision Р4 — Giant Ice Asteroid's two
 * degrees and two oceans are one question for 4 data, never four questions).
 *
 * HOW IT STANDS IN THE ENGINE'S ORDER. The dispatcher
 * (`ParliamentHandler.divertTerraforming`) opens the law's effect scope and
 * runs the card's hook; the hook journals the unit and accrues it here. The
 * FIRST unit of an operation queues the LANDING — one deferred step at the
 * BACK OF THE LINE, so every unit the same operation still produces (a
 * two-ocean card's second ocean, a step a later deferred placement would have
 * made) is accrued before the question is asked; the landing reads the total
 * at its own execution and flushes the accumulator, so a unit arriving after
 * it (nothing in scope does) would simply open a new one.
 *
 * The landing is queued from INSIDE the law's scope on purpose: a deferred
 * step captures the scope it was queued in (`EventRecorder.captureContext`),
 * so the data landing on the chosen card — or its named loss — is a CHILD of
 * the law's own `effect-triggered` marker (channel `terraforming-diverted`):
 * the journal groups it under the law, the notification's law card carries
 * the «+N [data]» chip, the stats credit the law once. The chairman quest
 * still counts it as the seat's own deed (decision Р6 — the one named
 * exception of `QuestTracker.eligible`, keyed on this very channel).
 *
 * The accumulator lives in memory only, keyed by the player object: a reload
 * drops the deferred queue as it drops every pending deferred step, and a
 * new game has new player objects — nothing is serialized, nothing can go
 * stale.
 *
 * THE NET. `Game.addGreenery` / `Game.addOcean` ask `caughtAtNet` when a
 * seat under the law still reached them outside the World Government's phase:
 * the rule is enforced there regardless (the unit is diverted, the tile is
 * not seated), the miss is counted and logged as an illegal state (a throw
 * under `THROW_STATE_ERRORS`), and the sweep guard requires the count to be
 * zero — a door the entries missed is a defect the worklist names, never a
 * rule a player can get around.
 */
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {ChoiceContextSource} from '../../../common/models/PlayerInputModel';
import {message} from '../../logs/MessageBuilder';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {SimpleDeferredAction} from '../../deferredActions/DeferredAction';
import {Priority} from '../../deferredActions/Priority';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';
import {cardResourceGain} from '../../cards/actionPreviews';
import {TileType} from '../../../common/TileType';
import {ICard} from '../../cards/ICard';
import {TerraformingUnit} from './IResolution';

/** The ONE title of the «where» question — the live prompt's and the pre-collected step's alike. */
export const DIVERTED_DATA_PICK_TITLE = 'Select the card for ${0} data diverted from terraforming';
/** The reason of the named loss when no card of the seat's can take the data. */
export const DIVERTED_NO_HOLDER_REASON = 'No card can hold the diverted data';
/** The label of the lost effect — what the skip row and the loss chip name. */
export const DIVERTED_DATA_LABEL = 'Data diverted from terraforming';

/** The data ONE unit becomes under the family's law: one per step, one per tile. */
export function dataOfUnit(unit: TerraformingUnit): number {
  return unit.kind === 'parameter' ? unit.steps : unit.count;
}

/** The asker every diverted question names — the law, by its catalog id. */
export function divertedSource(resolution: ResolutionId): ChoiceContextSource {
  return {kind: 'resolution', resolution};
}

/** The journal's own words for a unit (the parameter as its token, the tile as its type). */
export function logDivertedUnit(game: IGame, player: IPlayer, resolution: ResolutionId, unit: TerraformingUnit): void {
  const data = dataOfUnit(unit);
  if (unit.kind === 'parameter') {
    game.log('${0}: ${1} replaces ${2} step(s) of ${3} with ${4} data', (b) =>
      b.player(player).resolution(resolution).number(unit.steps).globalParameter(unit.parameter).number(data));
  } else {
    game.log('${0}: ${1} replaces ${2} ${3} tile(s) with ${4} data', (b) =>
      b.player(player).resolution(resolution).number(unit.count).tileType(unit.tile === 'greenery' ? TileType.GREENERY : TileType.OCEAN).number(data));
  }
}

/**
 * MARSBOT'S REPLACEMENT (decision D13, the owner 2026-10-24): the law binds the
 * bot like any seat — its unit is not performed — but the bot holds no card
 * resource, so each datum it would have received is 1 M€ into its stock,
 * at once (no question to ask, nothing to accrue). Inside the dispatcher's
 * scope like the data, so the journal and the notification name the law.
 */
export function divertIntoBotMegacredits(bot: IPlayer, resolution: ResolutionId, unit: TerraformingUnit): number {
  const megacredits = dataOfUnit(unit);
  const game = bot.game;
  if (unit.kind === 'parameter') {
    game.log('${0}: ${1} replaces ${2} step(s) of ${3} with ${4} M€', (b) =>
      b.player(bot).resolution(resolution).number(unit.steps).globalParameter(unit.parameter).number(megacredits));
  } else {
    game.log('${0}: ${1} replaces ${2} ${3} tile(s) with ${4} M€', (b) =>
      b.player(bot).resolution(resolution).number(unit.count).tileType(unit.tile === 'greenery' ? TileType.GREENERY : TileType.OCEAN).number(megacredits));
  }
  bot.stock.add(Resource.MEGACREDITS, megacredits);
  return megacredits;
}

type Pending = {resolution: ResolutionId, data: number};

/** The accumulator of the operation in flight, per seat (in memory only — see the header). */
const pending = new WeakMap<IPlayer, Pending>();

/** The data accrued so far for `player`'s operation in flight (0 when none) — read by the specs. */
export function pendingDivertedData(player: IPlayer): number {
  return pending.get(player)?.data ?? 0;
}

/**
 * ACCRUE the data of `unit` into the seat's operation and make sure its ONE
 * landing is queued. Called by the law's hook from INSIDE the dispatcher's
 * scope (see the header for why the queuing must happen there). Returns the
 * running total.
 */
export function divertIntoData(player: IPlayer, resolution: ResolutionId, unit: TerraformingUnit): number {
  const data = dataOfUnit(unit);
  const open = pending.get(player);
  if (open !== undefined) {
    open.data += data;
    return open.data;
  }
  pending.set(player, {resolution, data});
  player.game.defer(new SimpleDeferredAction(player, () => landDivertedData(player), Priority.BACK_OF_THE_LINE));
  return data;
}

/**
 * THE LANDING — the one question of the operation, built from the total the
 * accumulator holds at this moment (then flushed). The SAME shared picker
 * every law and card uses (`AddResourcesToCard`, `autoSelect: false` — one
 * holder is still SHOWN and confirmed, the «to any card» law of this fork),
 * the law as its asker (`cause`) and as the journal's source (`from`), and
 * the structural `diverted` marker so a host can tell this pick from the
 * enactment's payout. No holder: the loss is NAMED with its size under the
 * law's own reason — never a silent zero.
 */
function landDivertedData(player: IPlayer): ReturnType<AddResourcesToCard['execute']> {
  const open = pending.get(player);
  pending.delete(player);
  if (open === undefined || open.data <= 0) {
    return undefined;
  }
  const {resolution, data} = open;
  const step = new AddResourcesToCard(player, CardResource.DATA, {
    count: data,
    autoSelect: false,
    title: message(DIVERTED_DATA_PICK_TITLE, (b) => b.number(data)),
    cause: divertedSource(resolution),
    from: {resolution},
    diverted: {resolution},
  });
  if (step.getCards().length === 0) {
    player.game.log('${0} has no card that can hold data — ${1} data from ${2} are lost', (b) =>
      b.player(player).number(data).resolution(resolution));
    recordSkippedEffect(player, DIVERTED_NO_HOLDER_REASON, skippedDivertedData(data), {log: false});
    return undefined;
  }
  return step.execute();
}

/** WHAT is lost when no card can take the diverted data — one description for the preview's reading and the record. */
export function skippedDivertedData(data: number) {
  return {label: DIVERTED_DATA_LABEL, effect: cardResourceGain(CardResource.DATA, data)};
}

/** The pick's live prompt, built read-only for a preview — the SAME options the landing uses, so promise = prompt. */
export function divertedDataPicker(player: IPlayer, resolution: ResolutionId, data: number, cardBeingPlayed?: ICard): AddResourcesToCard {
  return new AddResourcesToCard(player, CardResource.DATA, {
    count: data,
    autoSelect: false,
    title: message(DIVERTED_DATA_PICK_TITLE, (b) => b.number(data)),
    cause: divertedSource(resolution),
    from: {resolution},
    diverted: {resolution},
    ...(cardBeingPlayed !== undefined ? {cardBeingPlayed} : {}),
  });
}

// ───────────────────────── the net ─────────────────────────

const net = {catches: 0};

/** How many times a unit reached the engine's seating doors under the law (the sweep requires 0). */
export function divertedNetCatches(): number {
  return net.catches;
}

export function resetDivertedNet(): void {
  net.catches = 0;
}

/**
 * A greenery / ocean reached `Game.addGreenery` / `Game.addOcean` for a seat
 * under the law, outside the World Government's phase — an entry missed. The
 * rule still holds (the caller diverts the unit and seats nothing); the miss
 * is counted, logged as an illegal state, and thrown under `THROW_STATE_ERRORS`.
 */
export function caughtAtNet(game: IGame, player: IPlayer, tile: 'greenery' | 'ocean'): void {
  net.catches++;
  const description = `A ${tile} tile reached the engine's seating door for ${player.color} under a law that replaces it — an entry is missing`;
  game.logIllegalState(description, {player: player.color, tile});
  if (process.env.THROW_STATE_ERRORS) {
    throw new Error(description);
  }
}
