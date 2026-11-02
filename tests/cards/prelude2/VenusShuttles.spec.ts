import {expect} from 'chai';
import {runAllActions} from '../../TestingUtils';
import {VenusShuttles} from '../../../src/server/cards/prelude2/VenusShuttles';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {Celestic} from '../../../src/server/cards/venusNext/Celestic';
import {JetStreamMicroscrappers} from '../../../src/server/cards/venusNext/JetStreamMicroscrappers';
import {IGame} from '../../../src/server/IGame';
import {cast} from '../../../src/common/utils/utils';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {SelectPayment} from '../../../src/server/inputs/SelectPayment';
import {JupiterFloatingStation} from '../../../src/server/cards/colonies/JupiterFloatingStation';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {TITLES} from '../../../src/server/inputs/titles';
import {Message} from '../../../src/common/logs/Message';
import {setRulingParty, setVenusScaleLevel} from '../../TestingUtils';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {MAX_VENUS_SCALE} from '../../../src/common/constants';
import {Tag} from '../../../src/common/cards/Tag';
import {addressVerdict, promptAddressOf} from '../../../src/common/inputs/preselectAddress';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardName} from '../../../src/common/cards/CardName';

describe('VenusShuttles', () => {
  let card: VenusShuttles;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new VenusShuttles();
    [game, player] = testGame(1, {venusNextExtension: true});
  });

  it('Should play, no cards', () => {
    card.play(player);
  });

  it('Should play, one option', () => {
    const celestic = new Celestic(); // Stores floaters, has Venus tag.
    player.playedCards.push(celestic);

    card.play(player);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.cb([celestic]);

    expect(celestic.resourceCount).to.eq(2);
  });

  it('Should Play, multiple cards.', () => {
    const celestic = new Celestic(); // Stores floaters. has Venus tag
    const jsr = new JetStreamMicroscrappers(); // Stores floaters, has Venus tag.
    player.playedCards.push(celestic);
    player.playedCards.push(jsr);
    cast(card.play(player), undefined);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards).includes(celestic);
    expect(selectCard.cards).includes(jsr);

    selectCard.cb([celestic]);
    expect(celestic.resourceCount).to.eq(2);
  });

  const canActRuns = [
    {mc: 11, tags: 0, expected: false},
    {mc: 12, tags: 0, expected: true},
    {mc: 6, tags: 5, expected: false},
    {mc: 7, tags: 5, expected: true},
    {mc: 0, tags: 12, expected: true},
  ] as const;
  for (const run of canActRuns) {
    it('canAct ' + JSON.stringify(run), () => {
      player.megaCredits = run.mc;
      player.tagsForTest = {venus: run.tags};
      expect(card.canAct(player)).eq(run.expected);
    });
  }

  it('action', () => {
    player.megaCredits = 13;
    expect(player.terraformRating).eq(14);
    expect(game.getVenusScaleLevel()).eq(0);

    cast(card.action(player), undefined);

    runAllActions(game);

    expect(player.megaCredits).eq(1);
    expect(game.getVenusScaleLevel()).eq(2);
    expect(player.terraformRating).eq(15);
  });

  it('Action 15 venus tags', () => {
    expect(game.getVenusScaleLevel()).eq(0);
    player.tagsForTest = {venus: 15};
    player.megaCredits = 0;

    card.action(player);

    expect(player.megaCredits).eq(0);
  });

  // ── Premium (P89 · ledger DZ): the hooks the console reads ──────────────────────────────────────────────────────

  const titleOf = (title: string | Message) => typeof title === 'string' ? title : JSON.stringify(title);

  it('preview: the discounted price «12 → 10» with its counted Venus tags, the Venus step and its implied rating', () => {
    player.megaCredits = 15;
    player.tagsForTest = {venus: 2};
    setVenusScaleLevel(game, 10);
    const branch = actionPreview(player, card).branches[0];
    expect(branch.available).is.true;
    expect(branch.steps).is.empty;
    const price = branch.effects.find((e) => e.direction === 'cost' && e.icon === 'megacredits');
    expect(price).deep.include({amount: 10, printed: 12, current: 15, resulting: 5});
    expect(price?.basis).deep.eq([{count: 2, label: 'Your tags', tag: Tag.VENUS}]);
    expect(branch.effects.find((e) => e.icon === 'venus')).deep.include({current: 10, resulting: 12});
    expect(branch.effects.find((e) => e.icon === 'tr')).deep.include({amount: 1, implied: true});
  });

  it('preview: no discount → a plain price (no printed, no basis)', () => {
    player.megaCredits = 15;
    const price = actionPreview(player, card).branches[0].effects.find((e) => e.direction === 'cost');
    expect(price).deep.include({amount: 12});
    expect(price?.printed).is.undefined;
    expect(price?.basis).is.undefined;
  });

  it('preview: Helion pays with heat → the payment is a STEP with the live prompt’s own title', () => {
    player.megaCredits = 5;
    player.heat = 10;
    player.canUseHeatAsMegaCredits = true;
    const branch = actionPreview(player, card).branches[0];
    expect(branch.steps).has.length(1);
    const step = branch.steps[0];
    expect(step.kind).eq('input');
    if (step.kind !== 'input') {
      return;
    }
    expect(JSON.stringify(step.input.title)).eq(JSON.stringify(TITLES.payForCardAction(card.name)));
    // …and the live prompt the action defers carries the same title (the batch's address).
    card.action(player);
    runAllActions(game);
    const live = cast(player.popWaitingFor(), SelectPayment);
    expect(titleOf(live.title)).eq(titleOf(TITLES.payForCardAction(card.name)));
  });

  it('reason: one number — «Need 1 more M€» at 11 M€ without Venus tags', () => {
    player.megaCredits = 11;
    expect(card.canAct(player)).is.false;
    expect(card.actionUnavailableReason(player)).deep.eq({type: 'megacredits', message: 'Need ${0} more M€', params: ['1']});
  });

  it('reason: the Reds’ levy is inside the one number', () => {
    const [game2, p2] = testGame(2, {venusNextExtension: true, turmoilExtension: true});
    setRulingParty(game2, PartyName.REDS);
    p2.megaCredits = 13;
    expect(card.canAct(p2)).is.false;
    expect(card.actionUnavailableReason(p2)).deep.eq({type: 'megacredits', message: 'Need ${0} more M€', params: ['2']});
  });

  it('15 Venus tags: the price is zero — the preview reads «12 → 0» and the action asks nothing', () => {
    player.tagsForTest = {venus: 15};
    player.megaCredits = 0;
    const price = actionPreview(player, card).branches[0].effects.find((e) => e.direction === 'cost');
    expect(price).deep.include({amount: 0, printed: 12});
    card.action(player);
    runAllActions(game);
    expect(player.popWaitingFor()).is.undefined;
    expect(game.getVenusScaleLevel()).eq(2);
  });

  it('at 30 % the action stays legal and is NAMED futile («Venus is at its maximum»)', () => {
    player.megaCredits = 20;
    setVenusScaleLevel(game, MAX_VENUS_SCALE);
    expect(card.canAct(player)).is.true;
    const futility = card.actionFutility(player);
    expect(futility?.verdict).deep.include({kind: 'parameter-maxed'});
    const branch = actionPreview(player, card).branches[0];
    expect(branch.effects.find((e) => e.icon === 'venus')).deep.include({current: 30, resulting: 30});
  });


  it('on the alternative Venus board the step into 18 % is followed by the Venus bonus prompt', () => {
    const [game3, p3] = testGame(1, {venusNextExtension: true, altVenusBoard: true});
    setVenusScaleLevel(game3, 16);
    p3.megaCredits = 20;
    // The preview's Venus chip names the bonus the step earns (P89 · EE) — the claim and the door read it.
    const chip = actionPreview(p3, card).branches[0].effects.find((e) => e.icon === 'venus');
    expect(chip?.altVenusBonus).deep.eq({standard: 1, wild: false, from: 16, to: 18});
    expect(actionPreview(player, card).branches[0].effects.find((e) => e.icon === 'venus')?.altVenusBonus, 'never on the standard board').is.undefined;
    card.action(p3);
    runAllActions(game3);
    const bonus = p3.popWaitingFor();
    expect(bonus?.venusBonusPrompt?.kind).eq('standard');
    expect(bonus?.venusBonusPrompt?.step).deep.eq({from: 16, to: 18});
    expect(game3.getVenusScaleLevel()).eq(18);
  });

  describe('the Venus bonus PRE-SELECT (P89 · EL)', () => {
    function altTable(venus: number): [IGame, TestPlayer] {
      const [g, p] = testGame(1, {venusNextExtension: true, altVenusBoard: true});
      setVenusScaleLevel(g, venus);
      p.megaCredits = 20;
      p.steel = 0;
      return [g, p];
    }
    const bonusStep = (p: TestPlayer) => actionPreview(p, card).branches[0].steps.find((s) => s.kind === 'venusBonus');

    it('the preview carries the bonus as a STEP: the very prompt the server asks, addressed to this card', () => {
      const [, p] = altTable(16);
      const step = bonusStep(p);
      expect(step?.kind).eq('venusBonus');
      if (step?.kind !== 'venusBonus') {
        return;
      }
      expect(step.input.venusBonusPrompt).deep.include({kind: 'standard', baseCount: 1, step: {from: 16, to: 18}});
      expect(step.input.venusBonusPrompt?.source).deep.eq({kind: 'card', card: card.name});
      expect(step.for).deep.eq({role: 'venusBonus', source: {kind: 'card', card: card.name}});
      expect(bonusStep(player), 'never on the standard board').is.undefined;
      const [, below] = altTable(10);
      expect(bonusStep(below), 'no bonus below 18 %').is.undefined;
    });

    it('the live prompt names the card that raised the scale (the event scope) and its role', () => {
      const [g, p] = altTable(16);
      g.events.beginAction(p, {kind: 'card', card: card.name});
      card.action(p);
      runAllActions(g);
      const bonus = p.getWaitingFor()!;
      expect(bonus.venusBonusPrompt?.source).deep.eq({kind: 'card', card: card.name});
      expect(promptAddressOf(bonus)).deep.eq({role: 'venusBonus', source: {kind: 'card', card: card.name}});
    });

    it('the addressed answer LANDS on the bonus: nothing parked, nothing asked, the steel on the rail', () => {
      const [g, p] = altTable(16);
      const step = bonusStep(p)!;
      g.events.beginAction(p, {kind: 'card', card: card.name});
      card.action(p);
      runAllActions(g);
      const payment = p.getWaitingFor();
      const answers: Array<unknown> = [];
      if (payment instanceof SelectPayment) {
        answers.push({type: 'payment', payment: {...Payment.EMPTY, megacredits: 12}});
      }
      const amounts = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'].map((r) => ({type: 'amount', amount: r === 'steel' ? 1 : 0}));
      answers.push({type: 'and', responses: amounts, for: step.for});
      replayBatch(p, answers as Array<InputResponse>);
      runAllActions(g);
      expect(parkedBatchTailLength(p)).eq(0);
      expect(p.getWaitingFor(), 'the bonus was answered by the batch').is.undefined;
      expect(p.steel).eq(1);
      expect(g.getVenusScaleLevel()).eq(18);
    });

    it('a card\'s own branch pick never answers the bonus (an `or` answer is foreign to the role)', () => {
      const [g, p] = altTable(28);
      g.events.beginAction(p, {kind: 'card', card: card.name});
      card.action(p);
      runAllActions(g);
      const live = p.getWaitingFor();
      if (live instanceof SelectPayment) {
        p.process({type: 'payment', payment: {...Payment.EMPTY, megacredits: 12}});
        runAllActions(g);
      }
      const bonus = p.getWaitingFor()!;
      expect(bonus.venusBonusPrompt?.kind).eq('final');
      expect(addressVerdict({role: 'or', source: {kind: 'card', card: card.name}}, bonus), 'a branch pick').eq('foreign');
      expect(addressVerdict({role: 'venusBonus', source: {kind: 'card', card: card.name}}, bonus)).eq('own');
      expect(addressVerdict({role: 'venusBonus', source: {kind: 'card', card: CardName.DIRIGIBLES}}, bonus), 'another card\'s bonus').eq('foreign');
    });
  });

  it('play: a floater holder WITHOUT a Venus tag is not a candidate; a single Venus holder is still ASKED (T14)', () => {
    const celestic = new Celestic();
    const station = new JupiterFloatingStation();
    player.playedCards.push(celestic, station);
    card.play(player);
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.cards).deep.eq([celestic]);
  });

  it('play: two Venus holders → both offered', () => {
    const celestic = new Celestic();
    const dirigibles = new Dirigibles();
    player.playedCards.push(celestic, dirigibles);
    card.play(player);
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.cards).to.have.members([celestic, dirigibles]);
  });
});
