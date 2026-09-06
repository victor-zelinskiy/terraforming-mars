import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {ExternalDrawIntake} from '../../src/server/deferredActions/ExternalDrawIntake';
import {SolarLogistics} from '../../src/server/cards/promo/SolarLogistics';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {Game} from '../../src/server/Game';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '@/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

describe('ExternalDrawIntake', () => {
  it('grant draws NOW, withholds from the hand, and raises the mandatory take prompt', () => {
    const [game, player, player2] = testGame(2);
    const effect = new SolarLogistics();
    const trigger = new Asteroid();
    const deckBefore = game.projectDeck.drawPile.length;
    ExternalDrawIntake.grant(player, 2, {
      effectCard: effect, effectCardOwner: 'you', initiator: player2, triggerCard: trigger,
    });
    expect(game.projectDeck.drawPile.length, 'the cards left the deck at the trigger').eq(deckBefore - 2);
    expect(player.cardsInHand).is.empty;
    expect(player.pendingCardIntakes).has.length(1);
    const intake = player.pendingCardIntakes[0];
    expect(intake.count).eq(2);
    expect(intake.cards).has.length(2);
    runAllActions(game);
    const prompt = cast(player.getWaitingFor(), SelectCard);
    expect(prompt.externalDrawPrompt).deep.eq({
      intakeId: intake.id,
      count: 2,
      remaining: 2,
      effectCard: CardName.SOLAR_LOGISTICS,
      effectCardOwner: 'you',
      initiator: player2.color,
      triggerCard: CardName.ASTEROID,
    });
  });

  it('a partial take moves exactly those cards and re-issues the prompt with the remainder', () => {
    const [game, player, player2] = testGame(2);
    ExternalDrawIntake.grant(player, 3, {
      effectCard: new SolarLogistics(), effectCardOwner: 'you', initiator: player2,
    });
    runAllActions(game);
    const intake = player.pendingCardIntakes[0];
    const first = intake.cards[0].name;
    player.process({type: 'card', cards: [first]});
    runAllActions(game);
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([first]);
    expect(intake.cards).has.length(2);
    const reissued = cast(player.getWaitingFor(), SelectCard);
    expect(reissued.externalDrawPrompt?.remaining).eq(2);
    expect(reissued.externalDrawPrompt?.intakeId, 'same intake identity across takes').eq(intake.id);
    // «Take all» — the rest in one answer.
    player.process({type: 'card', cards: intake.cards.map((c) => c.name)});
    runAllActions(game);
    expect(player.cardsInHand).has.length(3);
    expect(player.pendingCardIntakes).is.empty;
    expect(player.getWaitingFor()?.externalDrawPrompt, 'no re-issued prompt after the last take').is.undefined;
  });

  it('a pending intake survives serialization and the prompt is re-derived on load', () => {
    const [game, player, player2] = testGame(2);
    ExternalDrawIntake.grant(player, 2, {
      effectCard: new SolarLogistics(), effectCardOwner: 'you', initiator: player2, triggerCard: new Asteroid(),
    });
    runAllActions(game);
    // Partial take BEFORE the save — the taken card must stay taken.
    const intake = player.pendingCardIntakes[0];
    const taken = intake.cards[0].name;
    player.process({type: 'card', cards: [taken]});

    const restored = Game.deserialize(structuredClone(game.serialize()));
    const restoredPlayer = restored.getPlayerById(player.id);
    expect(restoredPlayer.cardsInHand.map((c) => c.name), 'the taken card is in the restored hand').deep.eq([taken]);
    expect(restoredPlayer.pendingCardIntakes).has.length(1);
    const restoredIntake = restoredPlayer.pendingCardIntakes[0];
    expect(restoredIntake.id).eq(intake.id);
    expect(restoredIntake.count).eq(2);
    expect(restoredIntake.cards).has.length(1);
    expect(restoredIntake.effectCard).eq(CardName.SOLAR_LOGISTICS);
    expect(restoredIntake.initiator).eq(player2.color);
    expect(restoredIntake.triggerCard).eq(CardName.ASTEROID);
    // The prompt was re-derived (deferred actions are not serialized).
    runAllActions(restored);
    const prompt = cast(restoredPlayer.getWaitingFor(), SelectCard);
    expect(prompt.externalDrawPrompt?.intakeId).eq(intake.id);
    expect(prompt.externalDrawPrompt?.remaining).eq(1);
    // Finishing the restored intake works normally.
    restoredPlayer.process({type: 'card', cards: [restoredIntake.cards[0].name]});
    runAllActions(restored);
    expect(restoredPlayer.cardsInHand).has.length(2);
    expect(restoredPlayer.pendingCardIntakes).is.empty;
  });

  it('old saves without the field load with an empty queue', () => {
    const [game, player] = testGame(2);
    const serialized = structuredClone(game.serialize());
    for (const p of serialized.players) {
      delete (p as any).pendingCardIntakes;
    }
    const restored = Game.deserialize(serialized);
    expect(restored.getPlayerById(player.id).pendingCardIntakes).is.empty;
  });

  it('two intakes queue as two sequential prompts, each naming its own cause', () => {
    const [game, player, player2] = testGame(2);
    ExternalDrawIntake.grant(player, 1, {
      effectCard: new SolarLogistics(), effectCardOwner: 'you', initiator: player2, triggerCard: new Asteroid(),
    });
    ExternalDrawIntake.grant(player, 2, {
      effectCard: new Asteroid(), effectCardOwner: 'initiator', initiator: player2,
    });
    runAllActions(game);
    expect(player.pendingCardIntakes).has.length(2);
    const first = cast(player.getWaitingFor(), SelectCard);
    expect(first.externalDrawPrompt?.effectCard).eq(CardName.SOLAR_LOGISTICS);
    player.process({type: 'card', cards: [first.cards[0].name]});
    runAllActions(game);
    const second = cast(player.getWaitingFor(), SelectCard);
    expect(second.externalDrawPrompt?.effectCard).eq(CardName.ASTEROID);
    expect(second.externalDrawPrompt?.count).eq(2);
  });

  it('a mid-batch continuation outranks a second intake\'s queue position', () => {
    const [game, player, player2] = testGame(2);
    ExternalDrawIntake.grant(player, 2, {
      effectCard: new SolarLogistics(), effectCardOwner: 'you', initiator: player2,
    });
    ExternalDrawIntake.grant(player, 1, {
      effectCard: new Asteroid(), effectCardOwner: 'initiator', initiator: player2,
    });
    runAllActions(game);
    const first = cast(player.getWaitingFor(), SelectCard);
    player.process({type: 'card', cards: [first.cards[0].name]});
    // NO runAllActions here: the queue legitimately PAUSED on the re-issued
    // prompt (the test helper's runAll would pop the next action OVER it).
    const next = cast(player.getWaitingFor(), SelectCard);
    expect(next.externalDrawPrompt?.effectCard, 'the unfinished batch keeps the floor').eq(CardName.SOLAR_LOGISTICS);
    expect(next.externalDrawPrompt?.remaining).eq(1);
  });

  it('an empty deck skips loudly instead of granting a phantom intake', () => {
    const [game, player, player2] = testGame(2);
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    ExternalDrawIntake.grant(player, 1, {
      effectCard: new SolarLogistics(), effectCardOwner: 'you', initiator: player2,
    });
    expect(player.pendingCardIntakes).is.empty;
    const last = game.gameLog[game.gameLog.length - 1];
    expect(last.message).contains('drew no cards');
  });

  it('a MarsBot recipient is refused — bot draw effects resolve per Automa at the call site', () => {
    const [/* game */, player, player2] = testGame(2);
    (player as any).isMarsBot = true;
    expect(() => ExternalDrawIntake.grant(player, 1, {
      effectCard: new SolarLogistics(), effectCardOwner: 'you', initiator: player2,
    })).to.throw(/MarsBot/);
  });
});
