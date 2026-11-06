import {RandomMAOptionType} from '../../../src/common/ma/RandomMAOptionType';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {awardManifest} from '../../../src/server/awards/Awards';
import {AutomaSetup} from '../../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../../src/server/automa/AutomaState';
import {TestPlayer} from '../../TestPlayer';
import {AutomaTestOptions, testAutomaGame} from '../AutomaTestGame';

/**
 * A MarsBot game that plays a RANDOM milestone / award set — the set is GIVEN (the draw is unseeded), and the bot's mat
 * is dealt by the production path (`AutomaSetup.matFor` → the generator). Until the creator lets the «random
 * milestones and awards» box through with the bot (stage 6 of the framework), a game cannot be CREATED that way, so
 * the helper builds an ordinary one, swaps its set in and re-seats the bot's state on the generated mat — everything
 * else the state already held (decks, corporation, positions) carried over through the save path.
 */
export function testAutomaRandomSetGame(
  set: {milestones: ReadonlyArray<string>, awards: ReadonlyArray<string>},
  options: AutomaTestOptions = {},
  idSuffix = '-random-set',
): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame(options, idSuffix);
  seatRandomSet(game, set);
  return [game, human, bot];
}

/** Swaps a built game's milestone / award set for `set` and re-seats the bot on the mat the generator deals for it. */
export function seatRandomSet(game: IGame, set: {milestones: ReadonlyArray<string>, awards: ReadonlyArray<string>}): void {
  (game.gameOptions as {randomMA: RandomMAOptionType}).randomMA = RandomMAOptionType.UNLIMITED;
  game.milestones.splice(0, game.milestones.length, ...set.milestones.map((n) => milestoneManifest.createOrThrow(n)));
  game.awards.splice(0, game.awards.length, ...set.awards.map((n) => awardManifest.createOrThrow(n)));
  const mat = AutomaSetup.matFor(game);
  const printed = game.automa!.profile.corporateCompetition;
  const swap = <T extends {kind: string, id?: BonusCardId}>(entry: T): T =>
    (entry.kind === 'bonus' && entry.id === printed ? {...entry, id: BonusCardId.B14_CORPORATE_COMPETITION_MA} : entry);
  const serialized = game.automa!.serialize();
  game.automa = AutomaState.deserialize({
    ...serialized,
    // The deck was dealt with the map's printed Corporate Competition; a random-set game plays B14 instead.
    bonusDeck: serialized.bonusDeck.map((e) => (typeof e === 'string' ? e : swap(e))),
    actionDeck: serialized.actionDeck.map(swap),
    mat,
  }, game.gameOptions);
}
