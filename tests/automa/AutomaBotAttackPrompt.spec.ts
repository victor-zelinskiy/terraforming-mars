import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Birds} from '../../src/server/cards/base/Birds';
import {Fish} from '../../src/server/cards/base/Fish';
import {Pets} from '../../src/server/cards/base/Pets';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE MARSBOT ATTACK CONTEXT — the structured, translation-proof description a
 * hostile bot effect attaches to the choice it forces on its victim.
 *
 * These specs guard the CONTRACT the console reads: who attacked, with which of
 * the bot's cards, what leaves, and the exact per-candidate consequence
 * (resources, the CARD's own points, the player's total). Everything the client
 * used to have to recover by parsing an English sentence.
 */

function resolve(game: IGame, id: BonusCardId) {
  routeBonusCard(game, id, resolveBonusCard(game, id));
}

describe('MarsBot attack prompt context', () => {
  it('B02 Invasive Species marks its pick with the attacker, the SOURCE CARD and the effect', () => {
    const [game, human, bot] = testAutomaGame();
    const birds = new Birds();
    birds.resourceCount = 2;
    human.playedCards.push(birds);

    resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
    runAllActions(game);

    const prompt = cast(human.popWaitingFor(), SelectCard);
    const meta = prompt.botAttackPrompt;
    expect(meta, 'the pick carries the attack context').to.not.be.undefined;
    expect(meta?.attacker).eq(bot.color);
    expect(meta?.victim).eq(human.color);
    expect(meta?.source).deep.eq({kind: 'bonusCard', bonusCard: BonusCardId.B02_INVASIVE_SPECIES});
    expect(meta?.effect).eq('removeCardResource');
    expect(meta?.amount).eq(1);
    expect(meta?.cardResource).eq(CardResource.ANIMAL);
    // The rule that narrowed the set is a KEY, never a sentence the client parses.
    expect(meta?.restrictionKey).eq('Only your highest-scoring animal or microbe cards can be chosen.');
  });

  it('the TITLE no longer smuggles the source card name in brackets', () => {
    const [game, human] = testAutomaGame();
    const birds = new Birds();
    birds.resourceCount = 1;
    human.playedCards.push(birds);

    resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
    runAllActions(game);

    const prompt = cast(human.popWaitingFor(), SelectCard);
    const title = prompt.title;
    expect(typeof title).eq('string');
    expect(title as string).eq('Remove 1 resource from one of your cards');
  });

  it('the marker SERIALIZES onto the model (the client never reads the input object)', () => {
    const [game, human] = testAutomaGame();
    const birds = new Birds();
    birds.resourceCount = 2;
    human.playedCards.push(birds);

    resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
    runAllActions(game);

    const prompt = cast(human.getWaitingFor(), SelectCard);
    const model: SelectCardModel = prompt.toModel(human);
    expect(model.botAttackPrompt?.source).deep.eq({kind: 'bonusCard', bonusCard: BonusCardId.B02_INVASIVE_SPECIES});
    expect(model.botAttackPrompt?.targets.map((t) => t.card)).deep.eq([CardName.BIRDS]);
    // …and it survives RE-serialization, which is what a reconnect does: the
    // client asks for the player view again and the same live prompt is
    // re-modelled. A marker that only rode the first response would leave a
    // reconnected player with the generic card browser.
    expect(prompt.toModel(human).botAttackPrompt).deep.eq(model.botAttackPrompt);
  });

  describe('the per-candidate preview', () => {
    it('states resources before → after, and the CARD victory points that move', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds(); // 1 VP per animal.
      birds.resourceCount = 2;
      human.playedCards.push(birds);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const meta = cast(human.popWaitingFor(), SelectCard).botAttackPrompt;
      const target = meta?.targets[0];
      expect(target?.card).eq(CardName.BIRDS);
      expect(target?.resource).eq(CardResource.ANIMAL);
      expect(target?.resources).deep.eq({before: 2, after: 1});
      expect(target?.victoryPoints).deep.eq({before: 2, after: 1});
    });

    it('a NON-LINEAR formula is evaluated by the card\'s own rule, not by «1 cube = 1 VP»', () => {
      const [game, human] = testAutomaGame();
      // Pets: 1 VP per TWO animals, and its own resources are protected — so it
      // is the tie-break rate that matters. Tardigrades: 1 VP per FOUR microbes.
      const pets = new Pets();
      pets.resourceCount = 4;
      const tardigrades = new Tardigrades();
      tardigrades.resourceCount = 3;
      human.playedCards.push(pets, tardigrades);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const meta = cast(human.popWaitingFor(), SelectCard).botAttackPrompt;
      // Pets is protected, so Tardigrades is the only candidate: 3 → 2 microbes
      // is 0 → 0 VP. The reading is PRESENT (the card does score from microbes)
      // and STATIC — silence there would read as «this card scores nothing».
      expect(meta?.targets).lengthOf(1);
      expect(meta?.targets[0].card).eq(CardName.TARDIGRADES);
      expect(meta?.targets[0].resources).deep.eq({before: 3, after: 2});
      expect(meta?.targets[0].victoryPoints).deep.eq({before: 0, after: 0});
      // …and a removal that costs nothing must NOT claim a score change.
      expect(meta?.targets[0].score).to.be.undefined;
    });

    it('the TOTAL score is a DIFFERENT figure from the card\'s own points, and only when it moves', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds();
      birds.resourceCount = 3;
      human.playedCards.push(birds);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const meta = cast(human.popWaitingFor(), SelectCard).botAttackPrompt;
      const target = meta?.targets[0];
      const total = human.getVictoryPoints().total;
      expect(target?.victoryPoints).deep.eq({before: 3, after: 2});
      expect(target?.score).deep.eq({before: total, after: total - 1});
      // The two readings are genuinely different numbers (TR alone puts the
      // total well above a single card's points) — never one figure under two
      // labels.
      expect(target?.score?.before).not.eq(target?.victoryPoints?.before);
    });

    it('EVERY tied leader is offered, each with its own reading', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds(); // 1 VP per animal
      birds.resourceCount = 2;
      const fish = new Fish(); // 1 VP per animal — the same rate
      fish.resourceCount = 5;
      human.playedCards.push(birds, fish);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const prompt = cast(human.popWaitingFor(), SelectCard);
      expect(prompt.cards.map((c) => c.name)).to.have.members([CardName.BIRDS, CardName.FISH]);
      const meta = prompt.botAttackPrompt;
      expect(meta?.targets).lengthOf(2);
      const byName = new Map(meta!.targets.map((t) => [t.card, t]));
      expect(byName.get(CardName.BIRDS)?.resources).deep.eq({before: 2, after: 1});
      expect(byName.get(CardName.FISH)?.resources).deep.eq({before: 5, after: 4});
    });

    it('is READ-ONLY — building it removes nothing', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds();
      birds.resourceCount = 2;
      human.playedCards.push(birds);
      const scoreBefore = human.getVictoryPoints().total;

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);
      const prompt = cast(human.getWaitingFor(), SelectCard);
      prompt.toModel(human); // …and serializing it changes nothing either

      expect(birds.resourceCount, 'the cube is still on the card').eq(2);
      expect(human.getVictoryPoints().total).eq(scoreBefore);
    });
  });

  describe('server authority', () => {
    it('the pick is OFFERED even with a single candidate (no auto-select)', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds();
      birds.resourceCount = 1;
      human.playedCards.push(birds);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const prompt = cast(human.popWaitingFor(), SelectCard);
      expect(prompt.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);
      expect(birds.resourceCount, 'nothing left before the answer').eq(1);
    });

    it('REFUSES a target the rules never offered', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds(); // 1 VP per animal — the only legal target
      birds.resourceCount = 2;
      const tardigrades = new Tardigrades(); // a lower cube rate
      tardigrades.resourceCount = 4;
      human.playedCards.push(birds, tardigrades);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const prompt = cast(human.popWaitingFor(), SelectCard);
      expect(() => prompt.process({type: 'card', cards: [CardName.TARDIGRADES]})).to.throw();
      expect(tardigrades.resourceCount, 'the refused target is untouched').eq(4);
      expect(birds.resourceCount).eq(2);
    });

    it('the answer is what removes the cube — and it is attributed to the bot', () => {
      const [game, human] = testAutomaGame();
      const birds = new Birds();
      birds.resourceCount = 2;
      human.playedCards.push(birds);

      resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
      runAllActions(game);

      const prompt = cast(human.popWaitingFor(), SelectCard);
      expect(birds.resourceCount).eq(2);
      prompt.process({type: 'card', cards: [CardName.BIRDS]});
      expect(birds.resourceCount).eq(1);
    });
  });

  it('the DEV bonus-card seam puts a chosen effect at the top of the bot deck', () => {
    // The automa twin of `customProjectCards` — the only deterministic way to
    // reach ONE bot effect (its own probe, a rules question, a UI capture).
    const [game] = testAutomaGame({customBonusCards: [BonusCardId.B02_INVASIVE_SPECIES]});
    const automa = game.automa!;
    // The setup pulls the deck's TOP card into the starting action deck, so
    // the seam is visible there rather than in the remaining bonus deck.
    const bonuses = automa.actionDeck.filter((c) => c.kind === 'bonus');
    expect(bonuses.map((c) => c.kind === 'bonus' ? c.id : undefined))
      .contains(BonusCardId.B02_INVASIVE_SPECIES);
    expect(automa.bonusDeck.flatMap((c) => c.kind === 'bonus' ? [c.id] : []),
      'and it is no longer waiting in the deck')
      .not.contains(BonusCardId.B02_INVASIVE_SPECIES);
  });

  it('no valid target → no prompt at all (never an empty choice)', () => {
    const [game, human] = testAutomaGame();
    const pets = new Pets(); // protected
    pets.resourceCount = 2;
    human.playedCards.push(pets);

    resolve(game, BonusCardId.B02_INVASIVE_SPECIES);
    runAllActions(game);

    expect(human.getWaitingFor()).is.undefined;
    expect(pets.resourceCount).eq(2);
  });
});
