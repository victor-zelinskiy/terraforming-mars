import {expect} from 'chai';
import {AppliedScience} from '../../../src/server/cards/prelude2/AppliedScience';
import {Birds} from '../../../src/server/cards/base/Birds';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {SelfReplicatingRobots} from '../../../src/server/cards/promo/SelfReplicatingRobots';
import {AsteroidMining} from '../../../src/server/cards/base/AsteroidMining';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast, toName} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectResource} from '../../../src/server/inputs/SelectResource';
import {actionPreview, subAvailability} from '../../../src/server/models/actionPreview';
import {Executor} from '../../../src/server/behavior/Executor';
import {CardName} from '../../../src/common/cards/CardName';
import {SelectCardModel, SelectResourceModel} from '../../../src/common/models/PlayerInputModel';
import {replayBatch, parkedBatchTailLength} from '../../../src/server/inputs/deferredInputBatch';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {promptAddressOf} from '../../../src/common/inputs/preselectAddress';
import {ICard} from '../../../src/server/cards/ICard';
import {Behavior} from '../../../src/server/behavior/Behavior';

describe('AppliedScience', () => {
  let card: AppliedScience;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new AppliedScience();
    [game, player] = testGame(1, {prelude2Expansion: true});
  });

  const branches = (): ReadonlyArray<Behavior> => card.actionBehavior!.or!.behaviors;

  function seat(science: number): void {
    player.playedCards.push(card);
    card.resourceCount = science;
  }

  it('play: 6 science on the card, previewed as «6 on this card»', () => {
    player.playedCards.push(card);
    card.play(player);
    runAllActions(game);
    expect(card.resourceCount).eq(6);
  });

  it('cannot act with no science — the reason counts it', () => {
    seat(0);
    expect(card.canAct(player)).is.false;
    const preview = actionPreview(player, card);
    expect(preview.branches.every((b) => b.available === false)).is.true;
    expect(preview.branches[0].unavailableReason).is.not.undefined;
  });

  it('one science, no other holder: the standard branch alone, auto-resolved, its step is the resource pick', () => {
    seat(1);
    expect(card.canAct(player)).is.true;
    const preview = actionPreview(player, card);
    const [standard, onCard] = preview.branches;
    expect(standard.available).is.true;
    expect(standard.index).eq(-1);
    expect(onCard.available, 'the card itself is never the target of its own spend').is.false;
    expect(onCard.unavailableReason).eq('No card to add the resource to');
    expect(standard.effects.some((e) => e.icon === 'wild' && e.direction === 'gain' && e.amount === 1)).is.true;
    expect(standard.steps).has.length(1);
    const step = standard.steps[0];
    expect(step.kind).eq('input');
    const model = (step as {input: SelectResourceModel}).input;
    expect(model.type).eq('resource');
    expect(model.amount).eq(1);
    expect((step as {for?: unknown}).for).deep.eq({role: 'resource', source: {kind: 'card', card: CardName.APPLIED_SCIENCE}});

    // The live action: no OrOptions (autoSelect), the SAME SelectResource, addressed to the same role.
    card.action(player);
    runAllActions(game);
    const live = cast(player.popWaitingFor(), SelectResource);
    expect(live.toModel()).deep.eq(model);
    expect(promptAddressOf(live)).deep.eq({role: 'resource', source: {kind: 'card', card: CardName.APPLIED_SCIENCE}});
    expect(card.resourceCount).eq(0);
    live.cb('steel');
    runAllActions(game);
    expect(player.steel).eq(1);
  });

  it('two branches with a foreign holder; the pick lists Birds, never the card itself', () => {
    seat(3);
    const birds = new Birds();
    birds.resourceCount = 1;
    player.playedCards.push(birds);
    const preview = actionPreview(player, card);
    const [standard, onCard] = preview.branches;
    expect(standard.index).eq(0);
    expect(onCard.index).eq(1);
    // THE WILD-RESOURCE CHOICE (EO): the server stamps each branch's role — the console reads it, never a title.
    expect([standard.wildChoice, onCard.wildChoice]).deep.eq(['standard', 'onCard']);
    expect(onCard.available).is.true;
    const pick = onCard.steps.find((s) => s.kind === 'input');
    const model = (pick as {input: SelectCardModel}).input;
    expect(model.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);

    card.action(player);
    runAllActions(game);
    const or = cast(player.popWaitingFor(), OrOptions);
    expect(or.options).has.length(2);
    or.options[1].cb(undefined);
    runAllActions(game);
    const live = cast(player.popWaitingFor(), SelectCard<ICard>);
    expect(live.cards.map(toName)).deep.eq([CardName.BIRDS]);
    live.cb([birds]);
    runAllActions(game);
    expect(birds.resourceCount).eq(2);
    expect(card.resourceCount).eq(2);
  });

  it('a holder with nothing on it is shown DISABLED with its reason; SRR cards are candidates', () => {
    seat(2);
    const tardigrades = new Tardigrades();
    player.playedCards.push(tardigrades);
    const srr = new SelfReplicatingRobots();
    player.playedCards.push(srr);
    const mining = new AsteroidMining();
    srr.targetCards.push(mining);
    mining.resourceCount = 1;
    const onCard = actionPreview(player, card).branches[1];
    const model = (onCard.steps.find((s) => s.kind === 'input') as {input: SelectCardModel}).input;
    expect(model.cards.map((c) => c.name)).deep.eq([CardName.ASTEROID_MINING]);
    expect(model.disabledCards?.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
  });

  // THE ONE PREDICATE: the live `canExecute` and the preview's branch availability agree in every arrangement — the
  // upstream rule («not if the only candidate is the card itself») only covered the lone case; the fork drops the
  // paying card from the candidate set altogether (a −1 / +1 no-op is never offered).
  const arrangements: Array<{name: string, science: number, holders: Array<[() => ICard, number]>}> = [
    {name: 'no science, no holder', science: 0, holders: []},
    {name: '1 science, no holder', science: 1, holders: []},
    {name: '1 science, Birds 1', science: 1, holders: [[() => new Birds(), 1]]},
    {name: '6 science, Tardigrades 0', science: 6, holders: [[() => new Tardigrades(), 0]]},
    {name: '6 science, Dirigibles 2', science: 6, holders: [[() => new Dirigibles(), 2]]},
  ];
  for (const a of arrangements) {
    it(`canExecute ≡ preview availability — ${a.name}`, () => {
      seat(a.science);
      for (const [make, count] of a.holders) {
        const c = make();
        c.resourceCount = count;
        player.playedCards.push(c);
      }
      const executor = new Executor();
      for (const sub of branches()) {
        expect(subAvailability(player, card, sub).available, JSON.stringify((sub as {title?: unknown}).title)).eq(executor.canExecute(sub, player, card));
      }
    });
  }

  it('the batch answers the standard branch and its resource: steel +1, science −1, nothing asked', () => {
    seat(3);
    const birds = new Birds();
    birds.resourceCount = 1;
    player.playedCards.push(birds);
    const standard = actionPreview(player, card).branches[0];
    const step = standard.steps[0] as {for?: unknown};
    card.action(player);
    runAllActions(game);
    replayBatch(player, [
      {type: 'or', index: 0, response: {type: 'option'}},
      {type: 'resource', resource: 'steel', for: step.for},
    ] as Array<InputResponse>);
    runAllActions(game);
    expect(parkedBatchTailLength(player)).eq(0);
    expect(player.getWaitingFor()).is.undefined;
    expect(player.steel).eq(1);
    expect(card.resourceCount).eq(2);
  });

  it('the batch answers the card branch and its pick: Birds +1', () => {
    seat(3);
    const birds = new Birds();
    birds.resourceCount = 1;
    player.playedCards.push(birds);
    const onCard = actionPreview(player, card).branches[1];
    const step = onCard.steps.find((s) => s.kind === 'input') as {for?: unknown};
    card.action(player);
    runAllActions(game);
    replayBatch(player, [
      {type: 'or', index: 1, response: {type: 'option'}},
      {type: 'card', cards: [CardName.BIRDS], for: step.for},
    ] as Array<InputResponse>);
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
    expect(birds.resourceCount).eq(2);
    expect(card.resourceCount).eq(2);
  });

  it('the last science spent: the action is gone', () => {
    seat(1);
    card.action(player);
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('heat');
    runAllActions(game);
    expect(card.resourceCount).eq(0);
    expect(card.canAct(player)).is.false;
  });

  it('survives save / reload with its science', () => {
    player.playedCards.push(card);
    card.play(player);
    runAllActions(game);
    const json = player.serialize();
    expect(json.playedCards.find((c) => c.name === CardName.APPLIED_SCIENCE)?.resourceCount).eq(6);
  });
});
