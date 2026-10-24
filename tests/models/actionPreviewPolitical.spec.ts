import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {parsePoliticalActionSource, politicalActionPreview} from '../../src/server/models/politicalActionPreview';
import {seatEnacted} from '../parliament/parliamentArrange';
import {OPEN_IP_TRADE_ID} from '../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {TRADE_INDUSTRIES_ID} from '../../src/server/parliament/resolutions/unity/TradeIndustries';
import {RD_FUNDING_ID} from '../../src/server/parliament/resolutions/scientists/RdFunding';
import {LIVE_EXPERIMENTS_ID} from '../../src/server/parliament/resolutions/scientists/LiveExperiments';
import {Grass} from '../../src/server/cards/base/Grass';
import {CardName} from '../../src/common/cards/CardName';
import {runAllActions, setTemperature} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Payment} from '../../src/common/inputs/Payment';
import {parkedBatchTailLength, replayBatch} from '../../src/server/inputs/deferredInputBatch';
import {PlayerInput} from '../../src/server/PlayerInput';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  game.generation = 2;
  return [game, p1, p2, game.parliament!];
}

/**
 * THE ONE-FRAMEWORK CONTRACT on the server: a party's / the law's action is previewed in the card action's own shape,
 * over the very prompt the action menu nests — so the card actions' composer reads a party the way it reads a card, and
 * the answer it builds by `answer` lands on the live prompt byte for byte.
 */
describe('politicalActionPreview', () => {
  it('parses the wire form of a source — and refuses anything else', () => {
    expect(parsePoliticalActionSource('party:Reds')).deep.eq({kind: 'party', party: PartyName.REDS});
    expect(parsePoliticalActionSource(`law:${OPEN_IP_TRADE_ID}`)).deep.eq({kind: 'law', resolution: OPEN_IP_TRADE_ID});
    expect(parsePoliticalActionSource('party:Kelvinists')).is.undefined;
    expect(parsePoliticalActionSource('card:Ants')).is.undefined;
    expect(parsePoliticalActionSource('Reds')).is.undefined;
  });

  it('the Reds: a bare commit — one confirm branch, the option answer draws through the menu prompt', () => {
    const [game, p1, , parliament] = reduxGame();
    parliament.grantPartyEffect(p1, PartyName.REDS, 'test');
    const preview = politicalActionPreview(p1, {kind: 'party', party: PartyName.REDS});
    expect(preview?.answer).eq('option');
    expect(preview?.source).deep.eq({kind: 'party', party: PartyName.REDS});
    expect(preview?.branches).has.length(1);
    const [branch] = preview!.branches;
    expect(branch.available).is.true;
    expect(branch.index).eq(-1);
    expect(branch.effects.find((e) => e.icon === 'cards' && e.direction === 'gain')?.amount, 'the draw chip').eq(2);
    // The answer by `answer: 'option'` is the menu prompt's own.
    const prompt = ParliamentHandler.partyActionPrompt(p1, PartyName.REDS) as PlayerInput;
    const hand = p1.cardsInHand.length;
    p1.defer(prompt.process({type: 'option'}, p1));
    runAllActions(game);
    expect(p1.cardsInHand.length).eq(hand + 2);
    // …and the used action previews BLOCKED, with the parliament's reason — shown, never hidden.
    const used = politicalActionPreview(p1, {kind: 'party', party: PartyName.REDS});
    expect(used?.branches).has.length(1);
    expect(used?.branches[0].available).is.false;
    expect(used?.branches[0].unavailableReason).eq('This party action was already used this generation');
  });

  it('the Scientists: a choice — a branch per kind with a holder, each carrying its card pick; a kind with none SHOWN refused', () => {
    const [, p1, , parliament] = reduxGame();
    parliament.grantPartyEffect(p1, PartyName.SCIENTISTS, 'test');
    const tardigrades = new Tardigrades();
    p1.playedCards.push(tardigrades);
    const preview = politicalActionPreview(p1, {kind: 'party', party: PartyName.SCIENTISTS});
    expect(preview?.answer).eq('or');
    expect(preview?.branches).has.length(2);
    const [branch, refused] = preview!.branches;
    // The data branch has no holder: shown, disabled, with the reason — after the live one (runtime indices intact).
    expect(refused.available).is.false;
    expect(refused.index).eq(-1);
    expect(JSON.stringify(refused.unavailableReason)).contains('No card of yours can hold ${0}');
    expect(branch.index).eq(0);
    expect(branch.optionInput?.type).eq('card');
    expect(branch.effects).deep.eq([{direction: 'gain', icon: 'microbe', amount: 2, note: 'to a card'}]);
    const prompt = ParliamentHandler.partyActionPrompt(p1, PartyName.SCIENTISTS) as PlayerInput;
    p1.defer(prompt.process({type: 'or', index: branch.index, response: {type: 'card', cards: [tardigrades.name]}}, p1));
    runAllActions(p1.game);
    expect(tardigrades.resourceCount).eq(2);
  });

  it('the Industrialists: the prompt IS the input — one branch carrying the two-part pick', () => {
    const [, p1, , parliament] = reduxGame();
    parliament.grantPartyEffect(p1, PartyName.INDUSTRIALISTS, 'test');
    p1.production.override({steel: 1});
    const preview = politicalActionPreview(p1, {kind: 'party', party: PartyName.INDUSTRIALISTS});
    expect(preview?.answer).eq('direct');
    expect(preview?.branches).has.length(1);
    const input = preview!.branches[0].optionInput;
    expect(input?.type).eq('and');
    expect(input?.type === 'and' ? input.options.map((o) => o.type) : []).deep.eq(['or', 'or']);
  });

  it('Unity: the action RIDES the colony trade — one branch whose step is the trade\'s door, pinned to the party', () => {
    const [, p1, , parliament] = reduxGame();
    parliament.grantPartyEffect(p1, PartyName.UNITY, 'test');
    const preview = politicalActionPreview(p1, {kind: 'party', party: PartyName.UNITY});
    expect(preview?.branches).has.length(1);
    const [branch] = preview!.branches;
    expect(branch.available).is.true;
    expect(branch.optionInput).is.undefined;
    expect(branch.steps).deep.eq([{kind: 'colonyTrade', party: PartyName.UNITY}]);
  });

  it('a party without access previews blocked with its reason; a party without an action previews nothing', () => {
    const [, p1, , parliament] = reduxGame();
    expect(parliament.hasPartyEffect(p1, PartyName.REDS)).is.false;
    const blocked = politicalActionPreview(p1, {kind: 'party', party: PartyName.REDS});
    expect(blocked?.branches[0].available).is.false;
    expect(blocked?.branches[0].unavailableReason).eq('You do not have this party\'s effect');
    expect(politicalActionPreview(p1, {kind: 'party', party: PartyName.GREENS})).is.undefined;
  });

  it('the enacted law: Open IP Trade is a direct hand pick, Trade Industries a bare commit; another law previews nothing', () => {
    const [, p1, , parliament] = reduxGame();
    seatEnacted(parliament, OPEN_IP_TRADE_ID);
    p1.cardsInHand = [new Tardigrades()];
    const sale = politicalActionPreview(p1, {kind: 'law', resolution: OPEN_IP_TRADE_ID});
    expect(sale?.answer).eq('direct');
    expect(sale?.branches[0].optionInput?.type).eq('card');
    expect(politicalActionPreview(p1, {kind: 'law', resolution: TRADE_INDUSTRIES_ID}), 'not the enacted law').is.undefined;

    seatEnacted(parliament, TRADE_INDUSTRIES_ID);
    p1.megaCredits = 30;
    const fleet = politicalActionPreview(p1, {kind: 'law', resolution: TRADE_INDUSTRIES_ID});
    expect(fleet?.answer).eq('option');
    expect(fleet?.branches[0].available).is.true;
    // M€ alone pays the bill without asking — no step (the live path auto-pays).
    expect(fleet?.branches[0].steps, 'no titanium — the bill asks nothing').deep.eq([]);
  });

  it('Trade Industries with titanium: the bill is a PAYMENT step addressed to the law (the live SelectPaymentDeferred)', () => {
    const [, p1, , parliament] = reduxGame();
    seatEnacted(parliament, TRADE_INDUSTRIES_ID);
    p1.megaCredits = 30;
    p1.titanium = 3;
    const fleet = politicalActionPreview(p1, {kind: 'law', resolution: TRADE_INDUSTRIES_ID});
    const [step] = fleet!.branches[0].steps;
    expect(step?.kind).eq('input');
    expect(step?.kind === 'input' ? step.input.type : undefined).eq('payment');
    expect(step?.kind === 'input' ? step.for : undefined).deep.eq({role: 'payment', source: {kind: 'resolution', resolution: TRADE_INDUSTRIES_ID}});
  });

  it('ONE POST — Trade Industries\' [menu option, the bill\'s payment] lands in one replay, the bill never asked again', () => {
    const [, p1, , parliament] = reduxGame();
    seatEnacted(parliament, TRADE_INDUSTRIES_ID);
    p1.megaCredits = 30;
    p1.titanium = 3;
    const fleets = p1.colonies.getFleetSize();
    const preview = politicalActionPreview(p1, {kind: 'law', resolution: TRADE_INDUSTRIES_ID})!;
    const [step] = preview.branches[0].steps;
    p1.takeAction();
    const menu = cast(p1.getWaitingFor(), OrOptions);
    const index = menu.options.findIndex((o) => o.resolutionActionPrompt !== undefined);
    expect(index).gte(0);
    const price = (step.kind === 'input' ? (step.input as {amount: number}).amount : 0);
    const batch: Array<InputResponse> = [
      {type: 'or', index, response: {type: 'option'}},
      {type: 'payment', payment: {...Payment.EMPTY, megacredits: price}, ...(step.kind === 'input' && step.for !== undefined ? {for: step.for} : {})} as InputResponse,
    ];
    replayBatch(p1, batch);
    expect(p1.colonies.getFleetSize(), 'the fleet is bought').eq(fleets + 1);
    expect(p1.megaCredits).eq(30 - price);
    expect(parkedBatchTailLength(p1)).eq(0);
    expect(p1.getWaitingFor()?.type, 'the bill is never asked again').not.eq('payment');
  });

  it('R&D Funding: the repeat pick is the card composer\'s repeat SLOT — no option input, one repeatAction step', () => {
    const [game, p1, , parliament] = reduxGame();
    seatEnacted(parliament, RD_FUNDING_ID);
    const tardigrades = new Tardigrades();
    p1.playedCards.push(tardigrades);
    tardigrades.action(p1);
    runAllActions(game);
    p1.actionsThisGeneration.add(tardigrades.name);
    const repeat = politicalActionPreview(p1, {kind: 'law', resolution: RD_FUNDING_ID});
    expect(repeat?.answer).eq('direct');
    const [branch] = repeat!.branches;
    expect(branch.optionInput).is.undefined;
    expect(branch.steps).has.length(1);
    const [step] = branch.steps;
    expect(step.kind === 'input' ? step.repeatAction : undefined).is.true;
    expect(step.kind === 'input' ? (step.input as {cards: Array<{name: string}>}).cards.map((c) => c.name) : []).deep.eq([tardigrades.name]);
  });

  it('Live Experiments: the play is a SLOT step carrying the promised pick (the law\'s play model)', () => {
    const [game, p1, , parliament] = reduxGame();
    seatEnacted(parliament, LIVE_EXPERIMENTS_ID);
    setTemperature(game, -30);
    p1.megaCredits = 20;
    p1.cardsInHand = [new Grass()];
    const live = politicalActionPreview(p1, {kind: 'law', resolution: LIVE_EXPERIMENTS_ID});
    expect(live?.answer).eq('option');
    const steps = live!.branches[0].steps;
    expect(steps.map((s) => s.kind)).deep.eq(['lawPlay']);
    const play = steps[0].kind === 'lawPlay' ? steps[0].play : undefined;
    expect(play?.reserve).eq(6);
    expect(play?.input.cards.map((c) => c.name)).deep.eq([CardName.GRASS]);
  });
});
