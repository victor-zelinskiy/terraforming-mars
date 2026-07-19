import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {calculateVictoryPoints} from '../../src/server/game/calculateVictoryPoints';
import {AsteroidDeflectionSystem} from '../../src/server/cards/promo/AsteroidDeflectionSystem';
import {LawSuit} from '../../src/server/cards/promo/LawSuit';
import {StJosephOfCupertinoMission} from '../../src/server/cards/promo/StJosephOfCupertinoMission';
import {TollStation} from '../../src/server/cards/base/TollStation';
import {Birds} from '../../src/server/cards/base/Birds';
import {cast} from '../../src/common/utils/utils';
import {addCity, runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

// The official FAQ card rules (rulebook p.11) — see docs/AUTOMA_DATA_AUDIT.md §9.
describe('Automa promo cards (FAQ p.11)', () => {
  describe('LawSuit vs MarsBot', () => {
    it('B01 Meteor Shower attributes the bot as the removing player', () => {
      const [game, human, bot] = testAutomaGame();
      human.plants = 5;
      resolve(game, BonusCardId.B01_METEOR_SHOWER);
      expect(human.removingPlayers).contains(bot.id);
      expect(new LawSuit().canPlay(human)).is.true;
    });

    it('B02 Invasive Species cube removal attributes the bot', () => {
      const [game, human, bot] = testAutomaGame();
      const birds = new Birds();
      birds.resourceCount = 1;
      human.playedCards.push(birds);
      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);
      const prompt = cast(human.popWaitingFor(), SelectCard);
      prompt.process({type: 'card', cards: [CardName.BIRDS]});
      expect(human.removingPlayers).contains(bot.id);
    });

    it('suing the bot: steal 3 from the M€ supply; the card lands in the bot pile with NO VP loss', () => {
      const [/* game */, human, bot] = testAutomaGame();
      human.removingPlayers.push(bot.id);
      bot.megaCredits = 10;
      const card = new LawSuit();
      const play = cast(card.play(human), SelectPlayer);
      play.cb(bot);
      expect(bot.megaCredits).eq(7);
      expect(human.megaCredits).eq(3);
      expect(bot.tableau.has(CardName.LAW_SUIT)).is.true;
      expect(human.warmongerCards).eq(1);
      // FAQ: MarsBot doesn't resolve the icons nor lose points — the −1 VP
      // never lands in the bot's card-VP breakdown, and Hard/Brutal card VP
      // (automa.playedPile) never sees the card either.
      expect(calculateVictoryPoints(bot).victoryPoints).eq(0);
      expect(bot.game.automa!.playedPile).does.not.contain(CardName.LAW_SUIT);
    });

    it('the steal caps at what the bot holds', () => {
      const [/* game */, human, bot] = testAutomaGame();
      human.removingPlayers.push(bot.id);
      bot.megaCredits = 1;
      const play = cast(new LawSuit().play(human), SelectPlayer);
      play.cb(bot);
      expect(bot.megaCredits).eq(0);
      expect(human.megaCredits).eq(1);
    });
  });

  describe('St. Joseph of Cupertino Mission vs MarsBot', () => {
    it('a cathedral at a bot city: the bot spends 2 M€ and advances its least-advanced track — never a prompt', () => {
      const [game, human, bot] = testAutomaGame();
      const space = addCity(bot);
      // BUILDING (topmost) at 0 is the least-advanced track; its next cell is
      // empty (no cascade), so the assertion is a clean +1.
      game.automa!.board.tracks.forEach((t, i) => {
        t.position = i === THARSIS_TRACK.BUILDING ? 0 : 1;
      });
      bot.megaCredits = 5;
      human.megaCredits = 10;

      const card = new StJosephOfCupertinoMission();
      card.action(human);
      runAllActions(game);
      const selectSpace = cast(human.popWaitingFor(), SelectSpace);
      selectSpace.cb(space);
      runAllActions(game);

      expect(game.stJosephCathedrals).contains(space.id);
      expect(bot.megaCredits).eq(3);
      expect(game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position).eq(1);
      expect(human.getWaitingFor()).is.undefined;
    });

    it('a bot below 2 M€ spends nothing and advances nothing', () => {
      const [game, human, bot] = testAutomaGame();
      const space = addCity(bot);
      bot.megaCredits = 1;
      human.megaCredits = 10;

      const card = new StJosephOfCupertinoMission();
      card.action(human);
      runAllActions(game);
      const selectSpace = cast(human.popWaitingFor(), SelectSpace);
      selectSpace.cb(space);
      runAllActions(game);

      expect(game.stJosephCathedrals).contains(space.id);
      expect(bot.megaCredits).eq(1);
      expect(game.automa!.board.tracks.every((t) => t.position === 0)).is.true;
    });
  });

  it('Toll Station counts the bot Space track position (Counter → automaTagCount)', () => {
    const [game, human] = testAutomaGame();
    game.automa!.board.tracks[THARSIS_TRACK.SPACE].position = 4;
    const card = new TollStation();
    human.playedCards.push(card);
    card.play(human);
    expect(human.production.megacredits).eq(4);
  });

  it('Asteroid Deflection System blocks B01 Meteor Shower (plants protected)', () => {
    const [game, human] = testAutomaGame();
    human.plants = 7;
    human.playedCards.push(new AsteroidDeflectionSystem());
    expect(resolve(game, BonusCardId.B01_METEOR_SHOWER)).eq('destroy');
    expect(human.plants).eq(7);
  });
});
