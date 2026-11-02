import {expect} from 'chai';
import * as constants from '../../../src/common/constants';
import {Research} from '../../../src/server/cards/base/Research';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {ICard} from '../../../src/server/cards/ICard';
import {Atmoscoop} from '../../../src/server/cards/venusNext/Atmoscoop';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {FloatingHabs} from '../../../src/server/cards/venusNext/FloatingHabs';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, setRulingParty, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {testGame} from '../../TestGame';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {cast} from '@/common/utils/utils';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {addressVerdict} from '../../../src/common/inputs/preselectAddress';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {InputResponse} from '../../../src/common/inputs/InputResponse';

describe('Atmoscoop', () => {
  let card: Atmoscoop;
  let player: TestPlayer;
  let game: IGame;
  let dirigibles: Dirigibles;
  let floatingHabs: FloatingHabs;

  beforeEach(() => {
    card = new Atmoscoop();
    [game, player] = testGame(2, {venusNextExtension: true});
    dirigibles = new Dirigibles();
    floatingHabs = new FloatingHabs();
  });

  it('Cannot play', () => {
    player.playedCards.push(new Research());
    expect(card.canPlay(player)).is.not.true;
  });

  it('Should play - no targets', () => {
    player.playedCards.push(new Research(), new SearchForLife());
    expect(card.canPlay(player)).is.true;

    const action = cast(card.play(player), OrOptions);

    expect(action.options).has.lengthOf(2);
    const orOptions = cast(action.options[1], SelectOption);

    orOptions.cb(undefined);
    expect(game.getVenusScaleLevel()).to.eq(4);
  });

  it('Should play - single target', () => {
    player.playedCards.push(dirigibles);

    const orOptions = cast(card.play(player), OrOptions);
    const selectOption = cast(orOptions.options[1], SelectOption);
    selectOption.cb(undefined);

    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard<ICard>);
    selectCard.cb([dirigibles]);

    expect(game.getVenusScaleLevel()).to.eq(4);
    expect(dirigibles.resourceCount).to.eq(2);
  });

  it('Should play - multiple targets', () => {
    player.playedCards.push(dirigibles, floatingHabs);

    const orOptions = cast(card.play(player), OrOptions);

    // First the global parameter
    orOptions.options[0].cb();
    expect(game.getTemperature()).to.eq(-26);
    orOptions.options[1].cb();
    expect(game.getVenusScaleLevel()).to.eq(4);

    // Then the floaters
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard<ICard>);
    selectCard.cb([dirigibles]);
    expect(dirigibles.resourceCount).to.eq(2);
    selectCard.cb([floatingHabs]);
    expect(floatingHabs.resourceCount).to.eq(2);
  });

  it('Should play - single target, one global parameter maxed', () => {
    player.playedCards.push(dirigibles);
    setTemperature(game, constants.MAX_TEMPERATURE);

    cast(card.play(player), undefined);
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard<ICard>);
    selectCard.cb([dirigibles]);

    expect(game.getVenusScaleLevel()).to.eq(4);
    expect(dirigibles.resourceCount).to.eq(2);
  });

  it('Should play - single target, both global parameters maxed', () => {
    player.playedCards.push(dirigibles);
    setVenusScaleLevel(game, constants.MAX_VENUS_SCALE);
    setTemperature(game, constants.MAX_TEMPERATURE);

    cast(card.play(player), undefined);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard<ICard>);
    selectCard.cb([dirigibles]);
    expect(dirigibles.resourceCount).to.eq(2);
  });

  it('Should play - multiple targets, one global parameter maxed', () => {
    player.playedCards.push(dirigibles, floatingHabs);
    setTemperature(game, constants.MAX_TEMPERATURE);

    cast(card.play(player), undefined);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectCard<ICard>);

    action.cb([dirigibles]);
    expect(game.getVenusScaleLevel()).to.eq(4);
    expect(dirigibles.resourceCount).to.eq(2);
  });

  it('Should play - multiple targets, both global parameters maxed', () => {
    player.playedCards.push(dirigibles, floatingHabs);
    setVenusScaleLevel(game, constants.MAX_VENUS_SCALE);
    setTemperature(game, constants.MAX_TEMPERATURE);

    cast(card.play(player), undefined);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectCard<ICard>);

    action.cb([dirigibles]);
    expect(dirigibles.resourceCount).to.eq(2);
  });

  for (const run of [
    {megacredits: 21, titanium: 0, reds: false, expected: false},
    {megacredits: 22, titanium: 0, reds: false, expected: true},
    {megacredits: 18, titanium: 1, reds: false, expected: false},
    {megacredits: 20, titanium: 1, reds: false, expected: true},

    {megacredits: 27, titanium: 0, reds: true, expected: false},
    {megacredits: 28, titanium: 0, reds: true, expected: true},

    {megacredits: 30, titanium: 0, reds: true, temperature: -2, venus: 14, expected: false},
    {megacredits: 31, titanium: 0, reds: true, temperature: -2, venus: 14, expected: true},
  ] as const) {
    it('Can play ' + JSON.stringify(run), () => {
      [game, player] = testGame(2, {venusNextExtension: true, turmoilExtension: true});
      player.tagsForTest = {science: 3};
      if (run.reds) {
        setRulingParty(game, PartyName.REDS, 'rp01');
      }
      player.megaCredits = run.megacredits;
      player.titanium = run.titanium;
      if (run.temperature) {
        setTemperature(game, run.temperature);
      }
      if (run.venus) {
        setVenusScaleLevel(game, run.venus);
      }
      expect(player.canPlay(card)).eq(run.expected);
    });
  }

  describe('the Venus bonus PRE-SELECT behind the OR (PL-1505)', () => {
    function altTable(venus: number): [IGame, TestPlayer] {
      const [g, p] = testGame(1, {venusNextExtension: true, altVenusBoard: true});
      setVenusScaleLevel(g, venus);
      setTemperature(g, -10);
      p.playedCards.push(new Research(), new SearchForLife(), dirigibles);
      p.steel = 0;
      p.titanium = 0;
      return [g, p];
    }
    const bonusSteps = (p: TestPlayer) => cardPlayPreview(p, card).branches[0].steps.flatMap((s, i) => s.kind === 'venusBonus' ? [{s, i}] : []);
    const orIndex = (p: TestPlayer) => cardPlayPreview(p, card).branches[0].steps.findIndex((s) => s.kind === 'input' && s.input.type === 'or');

    it('the Venus OPTION earns the bonus: a CONDITIONAL step tied to that option, the bonus of the raise counted', () => {
      const [, p] = altTable(16);
      const steps = bonusSteps(p);
      expect(steps).has.lengthOf(1);
      const step = steps[0].s;
      if (step.kind !== 'venusBonus') {
        return;
      }
      expect(step.when).deep.eq({step: orIndex(p), option: 1});
      expect(step.input.venusBonusPrompt).deep.include({kind: 'standard', baseCount: 2, step: {from: 16, to: 20}});
      expect(step.for).deep.eq({role: 'venusBonus', source: {kind: 'card', card: card.name}});
    });

    it('no bonus below 16 % — the raise to 14 % crosses no bonus cell', () => {
      const [, p] = altTable(10);
      expect(bonusSteps(p)).is.empty;
    });

    it('the addressed answer lands on the bonus the Venus option raised: nothing parked, nothing asked', () => {
      const [g, p] = altTable(16);
      const step = bonusSteps(p)[0].s;
      g.events.beginAction(p, {kind: 'card', card: card.name});
      p.playCard(card);
      runAllActions(g);
      const amounts = (steel: number, titanium: number) =>
        ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'].map((r) => ({type: 'amount', amount: r === 'steel' ? steel : r === 'titanium' ? titanium : 0}));
      const answers: Array<unknown> = [
        {type: 'or', index: 1, response: {type: 'option'}},
        {type: 'card', cards: [dirigibles.name]},
        {type: 'and', responses: amounts(1, 1), for: step.for},
      ];
      replayBatch(p, answers as Array<InputResponse>);
      runAllActions(g);
      expect(parkedBatchTailLength(p)).eq(0);
      expect(p.getWaitingFor(), 'the bonus was answered by the batch').is.undefined;
      expect(g.getVenusScaleLevel()).eq(20);
      expect([p.steel, p.titanium]).deep.eq([1, 1]);
    });

    it('the live bonus is the card’s own (role venusBonus + Atmoscoop)', () => {
      const [g, p] = altTable(16);
      g.events.beginAction(p, {kind: 'card', card: card.name});
      p.playCard(card);
      runAllActions(g);
      cast(p.getWaitingFor(), OrOptions);
      p.process({type: 'or', index: 1, response: {type: 'option'}});
      runAllActions(g);
      let bonus = p.getWaitingFor();
      if (bonus instanceof SelectCard) {
        p.process({type: 'card', cards: [dirigibles.name]});
        runAllActions(g);
        bonus = p.getWaitingFor();
      }
      expect(bonus?.venusBonusPrompt?.kind).eq('standard');
      expect(addressVerdict({role: 'venusBonus', source: {kind: 'card', card: card.name}}, bonus!)).eq('own');
    });
  });
});
