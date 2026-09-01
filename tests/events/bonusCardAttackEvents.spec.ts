import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {Resource} from '../../src/common/Resource';
import {IGame} from '../../src/server/IGame';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {testAutomaGame} from '../automa/AutomaTestGame';

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

/**
 * A MarsBot bonus card's CAUSAL SOURCE survives the card leaving the game.
 *
 * The one-shot card resolves, harms a player, and is destroyed in the same
 * breath — so the victim's `resource-changed` event and the fate log line are
 * the only durable records. Both must carry the card's identity:
 *  - the event's `source` is the `bonusCard` EventSource, fixed at the moment
 *    the card ACTS (never re-derived from a live collection);
 *  - the fate line NAMES the card (a chained fallback card makes «бонусная
 *    карта» alone ambiguous).
 * This is what lets the notification / journal answer «какой именно картой»
 * after `destroyedBonusCards` is all that remains of it.
 */
describe('bonus-card attack events (source snapshot)', () => {
  it('the victim loss event carries the bonusCard source + the before → after snapshot', () => {
    const [game, human, bot] = testAutomaGame();
    human.plants = 7;
    expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('destroy');

    const loss = game.events.events.find((e) =>
      e.type === 'resource-changed' && e.player === human.color && e.impact.stock?.plants === -5);
    expect(loss, 'the victim loss event exists').is.not.undefined;
    expect(loss!.source).deep.eq({kind: 'bonusCard', bonusCard: BonusCardId.B01_METEOR_SHOWER, owner: bot.color});
    expect(loss!.impact.snapshot).deep.eq({resource: Resource.PLANTS, scope: 'stock', before: 7, after: 2});
  });

  it('the destroy fate line NAMES the card via a STRING token', () => {
    const [game, human] = testAutomaGame();
    human.plants = 7;
    resolve(game, BonusCardId.B01_METEOR_SHOWER);
    const fate = game.gameLog.find((m) => m.message === 'MarsBot bonus card ${0} was destroyed and removed from the game');
    expect(fate, 'the named fate line exists').is.not.undefined;
    expect(fate!.data[0]?.value).eq('Meteor Shower');
  });

  it('the bot own gain inside a bonus resolution is attributed to the card too', () => {
    const [game, , bot] = testAutomaGame();
    resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
    const gain = game.events.events.find((e) =>
      e.type === 'resource-changed' && e.player === bot.color && e.impact.stock?.megacredits === 5);
    expect(gain, 'the bot gain event exists').is.not.undefined;
    expect(gain!.source).deep.eq({kind: 'bonusCard', bonusCard: BonusCardId.B02_INVASIVE_SPECIES, owner: bot.color});
  });
});
