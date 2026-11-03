import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {toName} from '../../../src/common/utils/utils';
import {FloatingTradeHub} from '../../../src/server/cards/prelude2/FloatingTradeHub';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {newProjectCard} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {SelectAmount} from '../../../src/server/inputs/SelectAmount';
import {SelectResource} from '../../../src/server/inputs/SelectResource';
import {Units} from '../../../src/common/Units';
import {IGame} from '../../../src/server/IGame';
import {runAllActions} from '../../TestingUtils';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';

describe('FloatingTradeHub', () => {
  let card: FloatingTradeHub;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new FloatingTradeHub();
    [game, player] = testGame(2, {preludeExtension: true});
    player.playedCards.push(card);
  });

  it('can always act — the hub itself takes floaters', () => {
    expect(card.canAct()).is.true;
  });

  it('with no floater here, asks (a) directly — the hub is a target of ANY card, never applied silently', () => {
    expect(card.action(player)).is.undefined;
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards).deep.eq([card]);
    selectCard.cb([card]);
    expect(card.resourceCount).eq(2);
  });

  it('(a) offers every floater card, the hub included, and carries its gain marker', () => {
    player.playedCards.push(newProjectCard(CardName.TARDIGRADES)!);
    player.playedCards.push(newProjectCard(CardName.AERIAL_MAPPERS)!);
    card.resourceCount = 1;
    const orOptions = cast(card.action(player), OrOptions);
    expect(orOptions.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FLOATING_TRADE_HUB});
    cast(orOptions.options[0], SelectOption).cb(undefined);
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards.map(toName)).deep.eq([card.name, CardName.AERIAL_MAPPERS]);
    expect((selectCard.toModel(player) as SelectCardModel).resourceGainPrompt).is.not.undefined;
    const mappers = selectCard.cards[1];
    selectCard.cb([mappers]);
    expect(mappers.resourceCount).eq(2);
  });

  it('(b) is a SEQUENCE: the dial, then the resource prompt with the dial\'s X as its gain', () => {
    card.resourceCount = 4;
    const orOptions = cast(card.action(player), OrOptions);
    const selectAmount = cast(orOptions.options[1], SelectAmount);
    expect(selectAmount.min).eq(1);
    expect(selectAmount.max).eq(4);
    expect(selectAmount.maxByDefault).is.true;

    orOptions.process({type: 'or', index: 1, response: {type: 'amount', amount: 3}}, player);
    runAllActions(game);
    const selectResource = cast(player.popWaitingFor(), SelectResource);
    expect(selectResource.include).deep.eq(Units.keys);
    expect(selectResource.gainAmount).eq(3);
    expect(selectResource.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FLOATING_TRADE_HUB});
    // Nothing spent before the resource is chosen.
    expect(card.resourceCount).eq(4);

    selectResource.process({type: 'resource', resource: 'plants'});
    expect(player.stock.asUnits()).deep.eq(Units.of({plants: 3}));
    expect(card.resourceCount).eq(1);
  });

  it('the preview prints BOTH rows; (b) refused with its reason at zero floaters', () => {
    const preview = card.actionPreview(player);
    expect(preview.branches).has.length(2);
    expect(preview.branches[0].available).is.true;
    expect(preview.branches[0].index).eq(-1);
    expect(preview.branches[1].available).is.false;
    expect(preview.branches[1].unavailableReason).eq('No floaters on this card');
  });

  it('the preview of (b) carries the dial and the dial-bound resource step', () => {
    card.resourceCount = 5;
    const preview = card.actionPreview(player);
    const b = preview.branches[1];
    expect(b.index).eq(1);
    expect(b.optionInput?.type).eq('amount');
    const step = b.steps[0];
    expect(step.kind === 'input' && step.input.type === 'resource' && step.dialBound === true).is.true;
  });

  it('the play has no effect, said in a note', () => {
    const preview = card.cardPlayPreview(player);
    const steps = preview.branches[0].steps;
    expect(steps.some((s) => s.kind === 'note')).is.true;
  });

  it('ONE batch answers (b): the or + the dial nested, then the ADDRESSED resource — nothing asked, the log typed', () => {
    card.resourceCount = 4;
    const branch = actionPreview(player, card).branches[1];
    const step = branch.steps[0] as {for?: unknown};
    expect(step.for).deep.eq({role: 'resource', source: {kind: 'card', card: CardName.FLOATING_TRADE_HUB}});
    player.defer(card.action(player));
    runAllActions(game);
    replayBatch(player, [
      {type: 'or', index: 1, response: {type: 'amount', amount: 3}},
      {type: 'resource', resource: 'plants', for: step.for},
    ] as Array<InputResponse>);
    runAllActions(game);
    expect(parkedBatchTailLength(player)).eq(0);
    expect(player.getWaitingFor()).is.undefined;
    expect(player.plants).eq(3);
    expect(card.resourceCount).eq(1);
    const line = game.gameLog[game.gameLog.length - 1];
    expect(line.message).eq('${0} removes ${1} floaters from ${2} and gains ${3} ${4}');
    expect(line.data[4].type).eq(LogMessageDataType.RESOURCE);
  });

  it('ONE batch answers (a) with the hub itself as the target', () => {
    card.resourceCount = 1;
    player.playedCards.push(newProjectCard(CardName.DIRIGIBLES)!);
    const branch = actionPreview(player, card).branches[0];
    const step = branch.steps.find((s) => s.kind === 'input') as {for?: unknown};
    player.defer(card.action(player));
    runAllActions(game);
    replayBatch(player, [
      {type: 'or', index: 0, response: {type: 'option'}},
      {type: 'card', cards: [CardName.FLOATING_TRADE_HUB], for: step.for},
    ] as Array<InputResponse>);
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
    expect(card.resourceCount).eq(3);
  });
});
