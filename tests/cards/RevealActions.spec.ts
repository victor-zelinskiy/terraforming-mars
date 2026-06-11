import {expect} from 'chai';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {AsteroidDeflectionSystem} from '../../src/server/cards/promo/AsteroidDeflectionSystem';
import {Tag} from '../../src/common/cards/Tag';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

// Reveal / deck-check actions (SearchForLife, AsteroidDeflectionSystem) record a
// transient `player.lastReveal` — the revealed card + whether the condition fired
// + the reward — so the premium reveal-result overlay can show the outcome IN the
// modal instead of leaving the player to read the log. Their actionPreview also
// carries a `reveal` descriptor that drives the pre-confirm reveal slot.
describe('Reveal / deck-check actions', () => {
  describe('SearchForLife', () => {
    it('records the reveal result + condition met when a microbe tag is revealed', () => {
      const card = new SearchForLife();
      const [game, player] = testGame(2);
      player.playedCards.push(card);
      player.megaCredits = 1;
      const top = fakeCard({tags: [Tag.MICROBE]});
      game.projectDeck.drawPile.push(top);

      card.action(player);
      runAllActions(game); // pays 1 M€, then reveals + records.

      expect(player.lastReveal, 'lastReveal set').is.not.undefined;
      expect(player.lastReveal?.action).eq(card.name);
      expect(player.lastReveal?.revealed.name).eq(top.name);
      expect(player.lastReveal?.conditionMet).is.true;
      expect(player.lastReveal?.reward?.icon).eq('science');
      expect(card.resourceCount).eq(1);
    });

    it('records condition NOT met (no reward) when the microbe tag is absent', () => {
      const card = new SearchForLife();
      const [game, player] = testGame(2);
      player.playedCards.push(card);
      player.megaCredits = 1;
      game.projectDeck.drawPile.push(fakeCard({tags: [Tag.SCIENCE]}));

      card.action(player);
      runAllActions(game);

      expect(player.lastReveal?.conditionMet).is.false;
      expect(player.lastReveal?.reward).is.undefined;
      expect(card.resourceCount).eq(0);
    });

    it('actionPreview carries the reveal descriptor (microbe tag → science reward)', () => {
      const card = new SearchForLife();
      const [/* game */, player] = testGame(2);
      player.megaCredits = 1;
      const branch = card.actionPreview(player).branches[0];
      expect(branch.reveal, 'reveal descriptor').is.not.undefined;
      expect(branch.reveal?.check.tag).eq(Tag.MICROBE);
      expect(branch.reveal?.reward.icon).eq('science');
    });
  });

  describe('AsteroidDeflectionSystem', () => {
    it('records the reveal result + condition met when a space tag is revealed', () => {
      const card = new AsteroidDeflectionSystem();
      const [game, player] = testGame(2);
      player.playedCards.push(card);
      const top = fakeCard({tags: [Tag.SPACE]});
      game.projectDeck.drawPile.push(top);

      card.action(player);
      runAllActions(game);

      expect(player.lastReveal?.action).eq(card.name);
      expect(player.lastReveal?.revealed.name).eq(top.name);
      expect(player.lastReveal?.conditionMet).is.true;
      expect(player.lastReveal?.reward?.icon).eq('asteroid');
      expect(card.resourceCount).eq(1);
    });

    it('records condition NOT met when the space tag is absent', () => {
      const card = new AsteroidDeflectionSystem();
      const [game, player] = testGame(2);
      player.playedCards.push(card);
      game.projectDeck.drawPile.push(fakeCard({tags: [Tag.EARTH]}));

      card.action(player);
      runAllActions(game);

      expect(player.lastReveal?.conditionMet).is.false;
      expect(player.lastReveal?.reward).is.undefined;
    });

    it('actionPreview carries the reveal descriptor (space tag → asteroid reward)', () => {
      const card = new AsteroidDeflectionSystem();
      const [/* game */, player] = testGame(2);
      const branch = card.actionPreview(player).branches[0];
      expect(branch.reveal?.check.tag).eq(Tag.SPACE);
      expect(branch.reveal?.reward.icon).eq('asteroid');
    });
  });

  it('Player.process clears a stale lastReveal at the start of the next input', () => {
    const card = new SearchForLife();
    const [game, player] = testGame(2);
    player.playedCards.push(card);
    player.megaCredits = 1;
    game.projectDeck.drawPile.push(fakeCard({tags: [Tag.MICROBE]}));
    card.action(player);
    runAllActions(game);
    expect(player.lastReveal).is.not.undefined;

    // The player's NEXT input clears the reveal so it never lingers.
    player.setWaitingFor(new OrOptions(new SelectOption('ok', 'ok').andThen(() => undefined)), () => {});
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    expect(player.lastReveal).is.undefined;
  });
});
