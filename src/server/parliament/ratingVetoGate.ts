/*
 * THE ONE DOOR A RATING GOES THROUGH BEFORE THE ENGINE GRANTS IT
 * (Turmoil Redux — RX42 UNMI Veto, `ResolutionPassive.vetoRating`: «the
 * player(s) with the highest terraform rating ignore any rating they would
 * gain»).
 *
 * The second REPLACING law, and the lighter one: it takes only the RATING and
 * puts nothing in its place. There is exactly ONE entry — the first line of
 * `Player.increaseTerraformRating`, the funnel every rating of the game goes
 * through — so this module has no net, no accumulator and no per-door work.
 * What it owns:
 *  · WHO IS FIRST BY RATING — `ratingLeaders(game)`: every player of the
 *    game (MarsBot included — decision Р3: the bot is in the comparison) whose
 *    rating equals the maximum; a tie at the top is every one of them. Read
 *    LIVE at every event and at every model build, never stored or serialized
 *    (the status is a function of the table, and the table is the save).
 *  · THE GATE — `ratingVetoed(player)`: a vetoing law stands, the seat is in
 *    the law's `restriction` aspect (a human; MarsBot under `'politics'`), and
 *    the seat is first by rating right now. A pure QUERY, like
 *    `divertsTerraforming`: the previews' exit pass, the futility reader, the
 *    model and the readings all ask it.
 *  · THE DISPATCHER — `vetoRating(player, gain)`: the funnel asks it with the
 *    whole event; `true` means THE FUNNEL DOES NOT RAISE — the hook has already
 *    journaled the loss under the law's own effect scope (channel
 *    `rating-vetoed`), so the record, the notification and the stats name the
 *    law.
 *  · THE WATCH — `withRatingVetoWatch(player, mutate)`: the funnel wraps every
 *    mutation of a rating (a raise, a lowering) in it while a vetoing law
 *    stands; the set of seats first by rating is read before and after, and a
 *    seat that entered or left it is told so (`rating-veto-changed`).
 *
 * A module of its own, LIGHT, for the reason `divertedTerraformingGate.ts` is:
 * the previews and the lowest doors import it while `Card.ts` is still
 * initializing, and the parliament's hub cannot be imported there without
 * closing a cycle on the card class. `ParliamentHandler.vetoRating` /
 * `ratingVetoed` are this module's public face in the hub.
 */
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {PlayerId} from '../../common/Types';
import {RatingGain, ResolutionDefinition} from './resolutions/IResolution';
import {originOfScope} from './divertedTerraformingGate';

/**
 * EVERY PLAYER FIRST BY TERRAFORM RATING — the whole table compared, MarsBot
 * included; a tie at the top is every one of them. Pure: reads the ratings,
 * writes nothing.
 */
export function ratingLeaders(game: IGame): Set<PlayerId> {
  const leaders = new Set<PlayerId>();
  let top = -Infinity;
  for (const player of game.players) {
    if (player.terraformRating > top) {
      top = player.terraformRating;
      leaders.clear();
      leaders.add(player.id);
    } else if (player.terraformRating === top) {
      leaders.add(player.id);
    }
  }
  return leaders;
}

/** The highest rating among every OTHER player of the game — what the seat's own projection is measured against. */
export function highestOtherRating(player: IPlayer): number {
  let top = -Infinity;
  for (const other of player.game.players) {
    if (other.id !== player.id && other.terraformRating > top) {
      top = other.terraformRating;
    }
  }
  return top;
}

/** The ENACTED law that vetoes a rating, if one stands — undefined otherwise (every other law reads nothing here). */
export function vetoingDefinition(game: IGame | undefined): ResolutionDefinition | undefined {
  const enacted = game?.parliament?.enactedDefinition();
  return enacted?.passive?.vetoRating === undefined ? undefined : enacted;
}

/**
 * DOES A STANDING LAW BIND THIS SEAT'S RATING — the seat in the law's
 * `restriction` aspect, and first by rating right now? False while no vetoing
 * law stands, for a seat outside the aspect (MarsBot under `'none'`) and for a
 * seat not at the top.
 */
export function ratingVetoed(player: IPlayer): boolean {
  const game = player.game;
  const parliament = game?.parliament;
  if (parliament === undefined || vetoingDefinition(game) === undefined) {
    return false;
  }
  return parliament.participates(player, 'restriction') && ratingLeaders(game).has(player.id);
}

/**
 * THE STANDING LAW WHOSE VETO MAY TOUCH THIS SEAT — the gate the previews'
 * exit pass reads: the law stands and the seat is in its aspect, whether or
 * not it is first by rating RIGHT NOW (a seat a chip ahead of the others
 * becomes first by the first chip and loses the second — the pass projects
 * that; `ratingVetoed` answers only the present).
 */
export function ratingVetoLaw(player: IPlayer): ResolutionDefinition | undefined {
  const game = player.game;
  const parliament = game?.parliament;
  const law = vetoingDefinition(game);
  if (parliament === undefined || law === undefined || !parliament.participates(player, 'restriction')) {
    return undefined;
  }
  return law;
}

/**
 * ASK THE LAW TO VETO `gain` — the funnel grants NOTHING when this answers
 * true: the hook has journaled the loss with its magnitude under the law's
 * own effect scope on the channel `rating-vetoed` (so the named skip is the
 * law's own child, and the notification, the journal and the stats name the
 * law). A zero gain is nobody's; the gate keeps out every seat not first by
 * rating and every seat outside the aspect.
 */
export function vetoRating(player: IPlayer, gain: RatingGain): boolean {
  const law = vetoingDefinition(player.game);
  const hook = law?.passive?.vetoRating;
  if (law === undefined || hook === undefined || gain.steps <= 0 || !ratingVetoed(player)) {
    return false;
  }
  const origin = gain.origin ?? originOfScope(player.game.events.currentSource());
  return player.game.events.withEffectSource(player, {kind: 'resolution', id: law.id, owner: player.color}, 'rating-vetoed',
    () => hook(player, {...gain, ...(origin === undefined ? {} : {origin})}) === true);
}

/**
 * THE STATUS MOVES, AND THE MOVE IS NAMED: every mutation of a rating runs
 * inside this while a vetoing law stands — the seats first by rating are read
 * BEFORE and AFTER, and the symmetric difference is recorded
 * (`rating-veto-changed`: who entered the veto, who left it, the whole set
 * now) under the law's source, so a seat is told «the veto now binds you» /
 * «no longer binds you» the moment it is true. Seats outside the law's aspect
 * are never listed (the fact names the BOUND). No law — the mutation alone.
 */
export function withRatingVetoWatch(player: IPlayer, mutate: () => void): void {
  const game = player.game;
  const law = vetoingDefinition(game);
  const parliament = game?.parliament;
  if (game === undefined || law === undefined || parliament === undefined) {
    mutate();
    return;
  }
  const bound = (id: PlayerId) => parliament.participates(game.getPlayerById(id), 'restriction');
  const before = new Set([...ratingLeaders(game)].filter(bound));
  mutate();
  const after = new Set([...ratingLeaders(game)].filter(bound));
  const entered = [...after].filter((id) => !before.has(id));
  const left = [...before].filter((id) => !after.has(id));
  if (entered.length === 0 && left.length === 0) {
    return;
  }
  const colorOf = (id: PlayerId) => game.getPlayerById(id).color;
  // The move is JOURNALED seat by seat — the law's own line, so the journal and a rival's card read it as the law's.
  for (const id of entered) {
    game.log('${0} now has the highest terraform rating — ${1} refuses their rating', (b) => b.player(game.getPlayerById(id)).resolution(law.id));
  }
  for (const id of left) {
    game.log('${0} no longer has the highest terraform rating — ${1} refuses nothing of theirs', (b) => b.player(game.getPlayerById(id)).resolution(law.id));
  }
  game.events.recordRatingVetoChanged(player, {kind: 'resolution', id: law.id}, {
    entered: entered.map(colorOf),
    left: left.map(colorOf),
    leaders: game.playersInGenerationOrder.filter((p) => after.has(p.id)).map((p) => ({color: p.color, tr: p.terraformRating})),
  });
}
