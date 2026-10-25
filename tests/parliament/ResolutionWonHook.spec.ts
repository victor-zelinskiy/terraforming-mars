import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {ReduxParty, ResolutionId, ResolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, testGame} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {atSittingEnd, passToParliament, quietResolutionOf, seatResolution, settleParliamentGates} from './parliamentArrange';

/**
 * `ICard.onResolutionWon` — THE WINNER'S HOOK (first holder: Septem Tribus:redux). Called by the sitting at the
 * enactment for the WINNING PLAYER only, once, inside the card's effect scope, under the step's key; never for the
 * neutral player, never for a seat outside the party effects (MarsBot), never twice across a reload.
 */
const S = PartyName.SCIENTISTS;
const M = PartyName.MARS;
const R = PartyName.REDS;

type Call = {player: string, instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty, scoped: boolean};

/** A card on `player`'s table that records every call of the hook (and whether the recorder was inside its scope). */
function hookCard(game: IGame, player: IPlayer, calls: Array<Call>) {
  const card = fakeCard({});
  (card as unknown as {onResolutionWon: unknown}).onResolutionWon = (who: IPlayer, context: {instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty}) => {
    const scope = game.events.captureContext();
    calls.push({player: who.id, ...context, scoped: scope !== undefined});
  };
  player.playedCards.push(card);
  return card;
}

function table(): {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament} {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([S, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament};
}

function cubes(parliament: Parliament, player: IPlayer, party: ReduxParty, n: number): void {
  const slot = parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    parliament.placeVote(player, slot, parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

describe('ICard.onResolutionWon — the winner\'s hook', () => {
  it('the WINNING player\'s card is called once, inside its effect scope, with the won resolution and its party', () => {
    const t = table();
    const calls: Array<Call> = [];
    hookCard(t.game, t.p1, calls);
    const rival: Array<Call> = [];
    hookCard(t.game, t.p2, rival);
    cubes(t.parliament, t.p1, M, 3);
    const instance = t.parliament.slotOf(M)!.instance;
    passToParliament(t.game);
    settleParliamentGates(t.game);
    expect(t.parliament.rulingParty()).eq(M);
    expect(calls).has.length(1);
    expect(calls[0]).deep.include({player: t.p1.id, instance, party: M, scoped: true});
    expect(calls[0].resolution).eq(t.parliament.resolutionOf(instance).id);
    expect(rival, 'the rival did not win').deep.eq([]);
  });

  it('the NEUTRAL player\'s win calls nobody', () => {
    const t = table();
    const calls: Array<Call> = [];
    hookCard(t.game, t.p1, calls);
    passToParliament(t.game);
    settleParliamentGates(t.game);
    expect(calls).deep.eq([]);
  });

  it('a RELOAD mid-sitting (at its last step) never calls it again — the enactment\'s key is applied', () => {
    const t = table();
    cubes(t.parliament, t.p1, M, 3);
    let save: ReturnType<IGame['serialize']> | undefined;
    atSittingEnd(t.game, () => (save = structuredClone(t.game.serialize())));
    passToParliament(t.game);
    // The save holds the sitting at its last step, the enactment behind it. A hook card put on the RELOADED table
    // must not be called by the resumed chain.
    const game = Game.deserialize(save!);
    const calls: Array<Call> = [];
    hookCard(game, game.getPlayerById(t.p1.id), calls);
    settleParliamentGates(game);
    expect(game.parliament!.rulingParty()).eq(M);
    expect(calls).deep.eq([]);
  });

  it('MarsBot is never asked: outside the party-effects aspect', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'none'});
    const parliament = game.parliament!;
    game.playerIsFinishedWithResearchPhase(human);
    ([S, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const calls: Array<Call> = [];
    hookCard(game, bot, calls);
    hookCard(game, human, calls);
    expect(parliament.participates(bot, 'party-effects')).is.false;
    human.popWaitingFor();
    game.playerHasPassed(human);
    game.playerIsFinishedTakingActions();
    settleParliamentGates(game);
    expect(calls, 'the neutral player wins; the bot is never asked').deep.eq([]);
  });
});
