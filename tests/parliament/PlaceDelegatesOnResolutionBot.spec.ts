import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {colonySource} from '../../src/server/inputs/choiceContext';
import {PlaceDelegatesOnResolution} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * A DELEGATE GRANT TO MARSBOT (docs/TURMOIL_REDUX_MARSBOT.md §2): the bot never receives a parliament
 * prompt. «Add N delegates to a resolution» addressed to the bot is placed on the spot — free, from the
 * reserve, every delegate by the bot's own vote rules — and the human's door (the SelectParty prompt)
 * stays the human's (`VenusRedux.spec`).
 */
describe('PlaceDelegatesOnResolution — the MarsBot branch', () => {
  it('places the printed count from the reserve at once: no prompt, no bill, the bot\'s own choice per cube', () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
    const parliament = game.parliament!;
    parliament.slots.forEach((slot) => (slot.votes = []));
    const reserve = parliament.reserve(bot);
    bot.megaCredits = 7;
    game.defer(new PlaceDelegatesOnResolution(bot, 2, colonySource(ColonyName.VENUS_REDUX)));
    runAllActions(game);
    expect(bot.getWaitingFor(), 'the bot is never asked').is.undefined;
    expect(human.getWaitingFor(), 'nor is the human asked in its stead').is.undefined;
    const placed = parliament.slots.flatMap((slot) => slot.votes.filter((v) => v.owner === bot.id));
    expect(placed, 'two cubes on the table').has.length(2);
    expect(parliament.reserve(bot), 'both from the reserve').eq(reserve - 2);
    expect(parliament.lobby.has(bot.id), 'the free delegate stays in the lobby').is.true;
    expect(bot.megaCredits, 'a grant is free').eq(7);
    parliament.assertLedger(game);
  });

  it('a reserve short of the printed count places what it holds and stops — never a throw, never a prompt', () => {
    const [game, , bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
    const parliament = game.parliament!;
    parliament.slots.forEach((slot) => (slot.votes = []));
    // Spend the reserve onto the table down to ONE delegate.
    while (parliament.reserve(bot) > 1) {
      parliament.placeVote(bot, parliament.slots[0], 'reserve');
    }
    expect(parliament.reserve(bot)).eq(1);
    game.defer(new PlaceDelegatesOnResolution(bot, 3, colonySource(ColonyName.VENUS_REDUX)));
    runAllActions(game);
    expect(bot.getWaitingFor()).is.undefined;
    expect(parliament.reserve(bot)).eq(0);
    parliament.assertLedger(game);
  });

  it('an observer bot (mode «none») takes no part: nothing is placed and nothing is asked', () => {
    const [game, , bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
    const parliament = game.parliament!;
    const before = parliament.slots.map((slot) => slot.votes.length);
    game.defer(new PlaceDelegatesOnResolution(bot, 2, colonySource(ColonyName.VENUS_REDUX)));
    runAllActions(game);
    expect(bot.getWaitingFor()).is.undefined;
    expect(parliament.slots.map((slot) => slot.votes.length)).deep.eq(before);
  });
});
