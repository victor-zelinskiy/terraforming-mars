import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {
  grantTradeFleet, TRADE_FLEET_ICON, TRADE_INDUSTRIES, TRADE_INDUSTRIES_BILL, TRADE_INDUSTRIES_CODE, TRADE_INDUSTRIES_FLEET_FULL_REASON,
  TRADE_INDUSTRIES_ID, TRADE_INDUSTRIES_UNAFFORDABLE_KEY, TRADE_INDUSTRIES_USES_PER_GENERATION, tradeIndustriesFunds, tradeIndustriesPrice,
} from '../../src/server/parliament/resolutions/unity/TradeIndustries';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {actionBillPrice} from '../../src/common/parliament/actionBill';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {MAX_FLEET_SIZE} from '../../src/common/constants';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '../../src/common/cards/render/AltSecondaryTag';
import {Payment} from '../../src/common/inputs/Payment';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {PlayerInput} from '../../src/server/PlayerInput';
import {ResolutionActionPromptMeta} from '../../src/common/models/PlayerInputModel';
import {Message} from '../../src/common/logs/Message';
import {IPlayer} from '../../src/server/IPlayer';
import {IColony} from '../../src/server/colonies/IColony';
import {EventSource} from '../../src/common/events/EventSource';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {potentialActions} from '../../src/server/models/potentialActions';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {TradeWithUnity} from '../../src/server/parliament/TradeWithUnity';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {SkyDocks} from '../../src/server/cards/colonies/SkyDocks';
import {Luna} from '../../src/server/colonies/Luna';
import {Ganymede} from '../../src/server/colonies/Ganymede';
import {Triton} from '../../src/server/colonies/Triton';
import {quietWinnerIndex, seatQuiet} from './parliamentArrange';

/**
 * TRADE INDUSTRIES (Turmoil Redux, RX28) — the second resolution with an
 * ACTION and the first whose action COSTS something: «pay 12 M€ to gain an
 * extra trade fleet; you can pay with titanium, and you get a M€ discount
 * equal to 2 times your Influence». Chairman quest: trade 2 times.
 *
 * What these specs pin: the PRICE is one function over the DECLARED bill
 * (12 − 2 × influence, floored at zero — influence 6 buys the fleet for
 * nothing), read by the gate, the bill and the preview alike; the action is
 * a member of the party-action family (the marker, the menu, the model with
 * its reasons — the price NAMED when the seat cannot pay, a full fleet, a
 * spent use); the commit is PAY, THEN GAIN — the confirm defers the bill
 * (titanium at the engine's rate), and the use, the journal and the fleet
 * wait for its settlement: a bill never settled spends nothing and grants
 * nothing; an all-M€ seat is auto-charged; the generation boundary restores
 * the use; a reload keeps a spent one; MarsBot is never in it. The chairman
 * quest counts TRADES performed — the Unity party's free trade included —
 * never a bot's, never one under a resolution source or outside the action
 * phase; and its footnote draws the TRADE glyph with a digit.
 */
const TRADE = resolutionInstanceId(TRADE_INDUSTRIES_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** The card ENACTED without a sitting (the government holds it), the table in its action phase, everyone solvent. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatEnacted(parliament, TRADE);
  expect(parliament.enactedDefinition()).eq(TRADE_INDUSTRIES);
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** Influence exactly `n` for a seat whose Agenda does not move (no sitting in these specs): the track up to 5, a bonus beyond. */
function setInfluence(parliament: Parliament, player: IPlayer, n: number): void {
  const track = Math.min(n, 5);
  parliament.agenda.set(player.id, [0, 1, 3, 5, 8, 12][track]);
  parliament.influenceBonus.set(player.id, n > track ? [{amount: n - track, source: 'spec'}] : []);
  expect(parliament.influence(player)).eq(n);
}

/** A deterministic colony table: stock incomes only, no question at a trade. */
function quietColonies(game: IGame): void {
  game.colonies = [new Luna(), new Ganymede(), new Triton()];
}

/** The structural marker of an option (the `PlayerInput` interface does not declare the field). */
function markerOf(input: PlayerInput): ResolutionActionPromptMeta | undefined {
  return (input as {resolutionActionPrompt?: ResolutionActionPromptMeta}).resolutionActionPrompt;
}

/** The resolution action's option of the action menu, by its MARKER (never by its title). */
function actionOption(player: IPlayer): SelectOption | undefined {
  const option = ParliamentHandler.resolutionActionOptions(player).find((o: PlayerInput) => markerOf(o) !== undefined);
  return option === undefined ? undefined : cast(option, SelectOption);
}

/** The live BILL of the action, if that is what the seat is waiting for. */
function billOf(player: IPlayer): SelectPayment | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectPayment && markerOf(wf)?.stage === 'pay' ? wf : undefined;
}

function textOf(reason: string | Message): {key: string, params: Array<string>} {
  if (typeof reason === 'string') {
    return {key: reason, params: []};
  }
  return {key: reason.message, params: reason.data.map((d) => String(d.value))};
}

/** Run `f` as one of `player`'s own actions (a colony trade by default). */
function asOwnAction(player: IPlayer, f: () => void, source: EventSource = {kind: 'colony', name: player.game.colonies[0].name}): void {
  const events = player.game.events;
  events.beginAction(player, source, {category: 'colony'});
  try {
    f();
  } finally {
    events.endScope();
  }
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

describe('TradeIndustries', () => {
  describe('the catalog entry', () => {
    it('is RX28 of Unity — one copy, no compatibility (colonies are mandatory), no enactment at all, an action WITH A BILL, the two-trades quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(TRADE_INDUSTRIES_ID)).eq(TRADE_INDUSTRIES);
      expect(TRADE_INDUSTRIES_CODE).eq('RX28');
      expect(TRADE_INDUSTRIES_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX28')).eq(TRADE_INDUSTRIES);
      expect(TRADE_INDUSTRIES.party).eq(PartyName.UNITY);
      expect(TRADE_INDUSTRIES.compatibility, 'colonies are a Redux requirement, never a gate of the card').is.undefined;
      expect(TRADE_INDUSTRIES.scaled).is.undefined;
      expect(TRADE_INDUSTRIES.immediateSteps).is.undefined;
      expect(TRADE_INDUSTRIES.winnerSteps).is.undefined;
      expect(TRADE_INDUSTRIES.winnerReward).is.undefined;
      expect(TRADE_INDUSTRIES.worldSteps).is.undefined;
      expect(TRADE_INDUSTRIES.passive).is.undefined;
      expect(TRADE_INDUSTRIES.action, 'the action').is.not.undefined;
      expect(TRADE_INDUSTRIES.actionBill, 'declared as DATA beside the action').deep.eq({amount: 12, discountPerInfluence: 2, titanium: true});
      expect(TRADE_INDUSTRIES.text.action).eq('Pay 12 M€ to gain an extra trade fleet. You may pay with titanium, and the price is 2 M€ less per influence.');
      expect(TRADE_INDUSTRIES.text.effect).is.undefined;
      expect(TRADE_INDUSTRIES.quest).deep.eq({goal: {kind: 'trade'}, count: 2});
      expect(TRADE_INDUSTRIES.text.quest).eq('Trade 2 times');
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === TRADE), 'one physical copy').has.length(1);
      // No enactment: the stand's fallback family, as R&D Funding's.
      expect(familyOf(TRADE_INDUSTRIES)).eq('influence');
    });

    it('the face prints the ACTION row alone — the price in its titanium corner with the influence beside it, then the fleet marker', () => {
      const face = JSON.stringify(TRADE_INDUSTRIES.renderData);
      expect(face).to.contain(`"type":"${CardRenderItemType.MEGACREDITS}"`);
      expect(face).to.contain('"amount":12');
      // «You can pay for this with titanium» is ON the face — the corner bubble of the M€ square — not only in the sentence.
      expect(face, 'the titanium corner on the price').to.contain(`"secondaryTag":"${AltSecondaryTag.TITANIUM}"`);
      expect(face).to.contain(`"type":"${CardRenderItemType.INFLUENCE}"`);
      expect(face).to.contain(`"type":"${CardRenderItemType.TRADE_FLEET}"`);
      expect(face, 'the fleet marker, never the trade glyph, in the RULE').to.not.contain(`"type":"${CardRenderItemType.TRADE}"`);
    });

    it('the quest footnote draws the TRADE glyph with a digit — never the fleet marker, never two glyphs', () => {
      const foot = questRenderData(TRADE_INDUSTRIES.quest);
      const json = JSON.stringify(foot);
      expect(json).to.contain(`"type":"${CardRenderItemType.TRADE}"`);
      expect(json).to.contain('"amount":2');
      expect(json).to.contain('"showDigit":true');
      expect(json).to.not.contain(`"type":"${CardRenderItemType.TRADE_FLEET}"`);
      expect(foot.rows[0].filter((n) => n !== undefined && typeof n !== 'string'), 'ONE figure').has.length(1);
    });
  });

  describe('the price — ONE function over the declared bill', () => {
    it('is 12 − 2 × influence, floored at zero: influence 6 buys the fleet for nothing', () => {
      const table: Array<[number, number, number]> = [[0, 0, 12], [1, 2, 10], [2, 4, 8], [3, 6, 6], [5, 10, 2], [6, 12, 0], [7, 12, 0]];
      for (const [influence, discount, price] of table) {
        expect(actionBillPrice(TRADE_INDUSTRIES_BILL, influence), `influence ${influence}`).deep.eq({printed: 12, influence, discount, price});
      }
      expect(actionBillPrice(TRADE_INDUSTRIES_BILL, -3), 'a negative influence is no influence').deep.eq({printed: 12, influence: 0, discount: 0, price: 12});
    });

    it('reads the seat\'s LIVE influence from the parliament — the same number the gate, the bill and the preview see', () => {
      const [, p1, , parliament] = enacted();
      for (const influence of [0, 2, 3, 6]) {
        setInfluence(parliament, p1, influence);
        const price = tradeIndustriesPrice(p1);
        expect(price).deep.eq(actionBillPrice(TRADE_INDUSTRIES_BILL, influence));
        const preview = TRADE_INDUSTRIES.action!.preview(p1);
        expect(preview[0]).deep.include({direction: 'cost', icon: 'megacredits', amount: price.price, current: 20, resulting: 20 - price.price, note: 'titanium accepted'});
        expect(preview[0].basis).deep.eq([{count: influence, label: 'Influence'}, {count: price.discount, label: 'Discount'}]);
        expect(preview[1]).deep.include({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 1, resulting: 2});
        const option = actionOption(p1)!;
        expect(textOf(option.title)).deep.eq({key: 'Pay ${0} M€ for an extra trade fleet (Trade Industries)', params: [String(price.price)]});
      }
      // Without a seat (the manifest's rate): the printed sum, no discount, no pools.
      const printed = TRADE_INDUSTRIES.action!.preview();
      expect(printed[0]).deep.eq({direction: 'cost', icon: 'megacredits', amount: 12, note: 'titanium accepted'});
      expect(printed[1]).deep.eq({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1});
    });

    it('the seat\'s MEANS count titanium at the engine\'s own value', () => {
      const [, p1] = enacted();
      p1.megaCredits = 5;
      p1.titanium = 2;
      expect(tradeIndustriesFunds(p1)).eq(5 + 2 * 3);
      p1.increaseTitaniumValue();
      expect(tradeIndustriesFunds(p1)).eq(5 + 2 * 4);
    });
  });

  describe('the action — a member of the party-action family', () => {
    it('stands in the action menu beside the party actions, a CONFIRM carrying the marker, the price chips and the law as its source', () => {
      const [, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 2);
      const menu = p1.getActions();
      const index = menu.options.findIndex((o) => markerOf(o) !== undefined);
      expect(index, 'listed').greaterThan(-1);
      const option = cast(menu.options[index], SelectOption);
      expect(option.resolutionActionPrompt).deep.eq({
        resolution: TRADE_INDUSTRIES_ID, party: PartyName.UNITY, stage: 'choose', usesLeft: 1, usesPerGeneration: 1,
      });
      expect(option.buttonLabel).eq('Buy fleet');
      expect(option.choiceContext?.source).deep.eq({kind: 'resolution', resolution: TRADE_INDUSTRIES_ID});
      expect(option.metadata).deep.include({kind: 'generic', icon: 'megacredits', amount: 8});
      expect(option.metadata?.effects).deep.eq(TRADE_INDUSTRIES.action!.preview(p1));
      // …and the marker survives the wire (the input's own toModel — nesting-safe).
      const model = menu.toModel(p1);
      expect(model.options[index].resolutionActionPrompt).deep.eq(option.resolutionActionPrompt);
      expect(menu.options.filter((o) => (o as {partyActionPrompt?: unknown}).partyActionPrompt !== undefined).length).eq(ParliamentHandler.partyActionOptions(p1).length);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(1);
      expect(TRADE_INDUSTRIES.action!.usesPerGeneration(p1)).eq(TRADE_INDUSTRIES_USES_PER_GENERATION);
    });

    it('is NOT offered — and the model NAMES THE PRICE — when the seat cannot pay it, titanium counted', () => {
      const [game, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 2);
      p1.megaCredits = 5;
      p1.titanium = 0;
      expect(actionOption(p1), 'cannot pay 8').is.undefined;
      let model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({resolution: TRADE_INDUSTRIES_ID, party: PartyName.UNITY, hasAccess: true, usesLeft: 1, available: false});
      expect(textOf(model.reason)).deep.eq({key: TRADE_INDUSTRIES_UNAFFORDABLE_KEY, params: ['8', '5']});
      // One titanium (worth 3) closes the gap: 5 + 3 ≥ 8.
      p1.titanium = 1;
      expect(actionOption(p1), 'titanium pays').is.not.undefined;
      model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({available: true, reason: ''});
      expect(model.preview).deep.eq(TRADE_INDUSTRIES.action!.preview(p1));
      // …and at influence 6 nothing at all is needed.
      p1.megaCredits = 0;
      p1.titanium = 0;
      setInfluence(parliament, p1, 6);
      expect(actionOption(p1), 'free').is.not.undefined;
    });

    it('is NOT offered — with its own reason — when the fleet is already full, when the use is spent, or once another law took the slot', () => {
      const [game, p1, , parliament] = enacted();
      p1.colonies.setFleetSize(MAX_FLEET_SIZE);
      expect(actionOption(p1), 'a full fleet').is.undefined;
      let model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({available: false, reason: TRADE_INDUSTRIES_FLEET_FULL_REASON});
      p1.colonies.setFleetSize(1);
      expect(actionOption(p1)).is.not.undefined;
      parliament.recordResolutionActionUse(p1);
      expect(actionOption(p1), 'the use is spent').is.undefined;
      model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({usesLeft: 0, available: false, reason: 'This resolution action was already used this generation'});
      parliament.resetGenerationUses();
      expect(actionOption(p1)).is.not.undefined;
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(actionOption(p1)).is.undefined;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction).is.undefined;
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
    });

    it('the wheel\'s count of actions includes it — the same verdict the menu lists it by', () => {
      const [, p1] = enacted();
      const withLaw = potentialActions(p1).partyActions ?? 0;
      expect(withLaw).greaterThan(0);
      p1.megaCredits = 0;
      expect(potentialActions(p1).partyActions, 'the law drops out of the count when it cannot be paid').eq(withLaw - 1);
      p1.megaCredits = 20;
      expect(potentialActions(p1).partyActions).eq(withLaw);
    });

    it('PAY, THEN GAIN: the confirm raises the BILL (titanium accepted, the law its cause, the marker at stage `pay`) — nothing is granted or spent until it is settled', () => {
      const [game, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 2);
      p1.titanium = 2;
      const eventsBefore = game.events.events.length;
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      expect(billOf(p1), 'a payment prompt').is.not.undefined;
      const bill = cast(p1.popWaitingFor(), SelectPayment);
      expect(bill!.amount).eq(8);
      expect(bill!.paymentOptions.titanium).is.true;
      expect(bill!.resolutionActionPrompt).deep.eq({resolution: TRADE_INDUSTRIES_ID, party: PartyName.UNITY, stage: 'pay', usesLeft: 1, usesPerGeneration: 1});
      expect(bill!.choiceContext?.source).deep.eq({kind: 'resolution', resolution: TRADE_INDUSTRIES_ID});
      expect(textOf(bill!.title)).deep.eq({key: 'Select how to pay ${0} M€ for the trade fleet', params: ['8']});
      // The wire carries the marker too — the console hosts the bill by it.
      expect(bill!.toModel(p1).resolutionActionPrompt).deep.eq(bill!.resolutionActionPrompt);
      // BEFORE the bill is settled: no fleet, no use, no M€ moved, no header.
      expect(p1.colonies.getFleetSize()).eq(1);
      expect(parliament.resolutionActionUsesLeft(p1), 'the use waits for the bill').eq(1);
      expect(p1.megaCredits).eq(20);
      expect(p1.titanium).eq(2);
      expect(game.gameLog.some((e) => e.message === '${0} used the action of ${1}')).is.false;
      // SETTLED with 2 titanium (worth 6) and 2 M€.
      bill!.process({type: 'payment', payment: Payment.of({titanium: 2, megacredits: 2})}, p1);
      runAllActions(game);
      expect(p1.colonies.getFleetSize(), '+1 fleet').eq(2);
      expect(p1.titanium).eq(0);
      expect(p1.megaCredits).eq(18);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
      expect(parliament.resolutionActionUsesOf(p1)).eq(1);
      expect(game.gameLog.some((e) => e.message === '${0} used the action of ${1}')).is.true;
      const gain = game.gameLog.find((e) => e.message === '${0} gains a trade fleet from ${1} for ${2} M€ (${3} − ${4} for influence ${5}): fleets ${6} → ${7}');
      expect(gain, 'the journal names the price and its arithmetic').is.not.undefined;
      expect(gain!.data.slice(2).map((d) => d.value)).deep.eq(['8', '12', '4', '2', '1', '2']);
      // THE SCOPE: the action's root carries the law as its source; the M€ leave under the payment source inside it.
      const since = game.events.events.slice(eventsBefore);
      const root = since.find((e) => e.type === 'action');
      expect(root?.source).deep.eq({kind: 'resolution', id: TRADE_INDUSTRIES_ID, owner: p1.color});
      expect(root?.category).eq('parliament');
      expect(since.some((e) => e.source?.kind === 'payment'), 'the bill is a payment').is.true;
      expect(since.filter((e) => e.type === 'action'), 'ONE root for the whole thing').has.length(1);
      // …and it is gone from the menu until the next generation.
      expect(actionOption(p1)).is.undefined;
      expect(billOf(p1)).is.undefined;
    });

    it('a seat with no titanium is charged in M€ at once — no prompt, the fleet lands in the same breath', () => {
      const [game, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 3);
      p1.titanium = 0;
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      expect(billOf(p1), 'nothing to choose — auto-paid').is.undefined;
      expect(p1.megaCredits, '12 − 6').eq(14);
      expect(p1.colonies.getFleetSize()).eq(2);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
    });

    it('at influence 6 the fleet is FREE: no bill, no M€ moved, titanium untouched, the use spent', () => {
      const [game, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 6);
      p1.megaCredits = 0;
      p1.titanium = 3;
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      expect(billOf(p1)).is.undefined;
      expect(p1.megaCredits).eq(0);
      expect(p1.titanium).eq(3);
      expect(p1.colonies.getFleetSize()).eq(2);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
      const gain = game.gameLog.find((e) => e.message === '${0} gains a trade fleet from ${1} for ${2} M€ (${3} − ${4} for influence ${5}): fleets ${6} → ${7}');
      expect(gain!.data.slice(2).map((d) => d.value)).deep.eq(['0', '12', '12', '6', '1', '2']);
    });

    it('a bill the player never settles spends nothing and grants nothing — a reload inside it offers the action again', () => {
      const [game, p1, , parliament] = enacted();
      setInfluence(parliament, p1, 2);
      p1.titanium = 2;
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      expect(billOf(p1)).is.not.undefined;
      // A refused answer (not enough of the mix) keeps the bill standing and changes nothing.
      expect(() => billOf(p1)!.process({type: 'payment', payment: Payment.of({megacredits: 3})}, p1)).to.throw();
      expect(p1.colonies.getFleetSize()).eq(1);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(1);
      // The deferred queue is not serialized: after a reload the bill is gone, and so is every trace of the attempt.
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      expect(billOf(seat), 'the bill is gone').is.undefined;
      expect(seat.colonies.getFleetSize()).eq(1);
      expect(seat.megaCredits).eq(20);
      expect(seat.titanium).eq(2);
      expect(again.parliament!.resolutionActionUsesLeft(seat), 'not spent').eq(1);
      expect(actionOption(seat), 'offered again').is.not.undefined;
    });

    it('the fleet is the engine\'s own: one step, capped at the maximum, the count before and after returned', () => {
      const [, p1] = enacted();
      p1.colonies.setFleetSize(MAX_FLEET_SIZE - 1);
      expect(grantTradeFleet(p1, actionBillPrice(TRADE_INDUSTRIES_BILL, 0))).deep.eq({from: MAX_FLEET_SIZE - 1, to: MAX_FLEET_SIZE});
      expect(grantTradeFleet(p1, actionBillPrice(TRADE_INDUSTRIES_BILL, 0)), 'the engine caps').deep.eq({from: MAX_FLEET_SIZE, to: MAX_FLEET_SIZE});
    });

    it('the generation boundary restores the use — through the real sitting', () => {
      const [game, p1, , parliament] = enacted();
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
      // A quiet card wins the sitting (the deal is seeded and shifts with the catalog — never «slot 0»).
      const index = quietWinnerIndex(parliament);
      seatQuiet(parliament, index);
      parliament.placeVote(p1, parliament.slots[index], 'lobby');
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.resolutionActionUsesOf(p1), 'the counter is reset').eq(0);
    });

    it('a reload keeps the spent use and the fleet — nothing is paid twice, the option stays gone', () => {
      const [game, p1] = enacted();
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      expect(again.parliament!.resolutionActionUsesOf(seat)).eq(1);
      expect(seat.colonies.getFleetSize()).eq(2);
      expect(seat.megaCredits).eq(8);
      expect(actionOption(seat)).is.undefined;
    });

    it('a NON-participant never holds it: MarsBot is never offered the action, and its model carries no access', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.playerIsFinishedWithResearchPhase(human);
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatEnacted(parliament, TRADE);
      human.megaCredits = 20;
      bot.megaCredits = 20;
      expect(parliament.participates(bot)).is.false;
      expect(ParliamentHandler.resolutionActionOptions(bot)).is.empty;
      expect(getParliamentModel(game, bot)!.viewer!.resolutionAction).deep.include({hasAccess: false, available: false});
      expect(ParliamentHandler.resolutionActionOptions(human), 'the human holds it').has.length(1);
    });
  });

  describe('the chairman quest — trade 2 times', () => {
    function enactedTrade(): [IGame, TestPlayer, TestPlayer, Parliament, IColony] {
      const [game, p1, p2, parliament] = reduxGame();
      quietColonies(game);
      seatResolution(parliament, 0, TRADE);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.megaCredits = 20;
      p2.megaCredits = 20;
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      expect(parliament.enacted).eq(TRADE);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'trade'}, count: 2});
      expect(parliament.quest?.source).eq(TRADE_INDUSTRIES_ID);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.completedBy).is.undefined;
      return [game, p1, p2, parliament, game.colonies[0]];
    }

    it('the goal matches a trade and nothing else', () => {
      expect(QuestTracker.match({kind: 'trade'}, {kind: 'trade'})).eq(1);
      expect(QuestTracker.match({kind: 'trade'}, {kind: 'colony'})).eq(0);
      expect(QuestTracker.match({kind: 'trade'}, {kind: 'delegates', amount: 1})).eq(0);
      expect(QuestTracker.match({kind: 'colony'}, {kind: 'trade'}), 'and a trade is not a colony').eq(0);
    });

    it('TRADING twice completes it — through the one door every trade enters by (`Colony.trade`), whatever paid for it', () => {
      const [game, p1, , parliament, colony] = enactedTrade();
      asOwnAction(p1, () => colony.trade(p1));
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest?.completedBy).is.undefined;
      // The second trade: a different colony (the first is visited), paid any way at all.
      const other = game.colonies[1];
      asOwnAction(p1, () => other.trade(p1), {kind: 'colony', name: other.name});
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });

    it('the Unity party\'s FREE trade is a trade of the seat\'s own turn — it counts', () => {
      const [game, p1, , parliament, colony] = enactedTrade();
      // Two delegates on Unity's own law make the seat a holder of the party's effect; the law is Unity's, so it rules.
      expect(parliament.hasPartyEffect(p1, PartyName.UNITY), 'the ruling party\'s effect').is.true;
      const trader = new TradeWithUnity(p1);
      expect(trader.canUse()).is.true;
      asOwnAction(p1, () => trader.trade(colony));
      runAllActions(game);
      expect(parliament.questProgressOf(p1), 'the free trade counts').eq(1);
      expect(parliament.partyActionUsesLeft(p1, PartyName.UNITY), 'and the party use is spent as ever').eq(0);
    });

    it('a trade under a RESOLUTION source, or outside the action phase, never counts (decision Q5); another seat\'s trade is not mine', () => {
      const [game, p1, p2, parliament, colony] = enactedTrade();
      asOwnAction(p1, () => colony.trade(p1), {kind: 'resolution', id: TRADE_INDUSTRIES_ID, owner: p1.color});
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.PARLIAMENT;
      asOwnAction(p1, () => game.colonies[1].trade(p1));
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.ACTION;
      asOwnAction(p2, () => game.colonies[2].trade(p2), {kind: 'colony', name: game.colonies[2].name});
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(0);
      expect(parliament.questProgressOf(p2)).eq(1);
    });

    it('a BOT\'s trade never counts: it takes no seat — and its own trade never enters `Colony.trade` at all', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.playerIsFinishedWithResearchPhase(human);
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatEnacted(parliament, TRADE);
      quietColonies(game);
      parliament.quest = {definition: {goal: {kind: 'trade'}, count: 2}, source: TRADE_INDUSTRIES_ID, generation: game.generation, progress: new Map()};
      const colony = game.colonies[0];
      const events = game.events;
      events.beginAction(bot, {kind: 'colony', name: colony.name}, {category: 'automa-turn'});
      try {
        colony.trade(bot);
      } finally {
        events.endScope();
      }
      runAllActions(game);
      expect(parliament.questProgressOf(bot)).eq(0);
      expect(parliament.questProgressOf(human)).eq(0);
      expect(QuestTracker.eligible(bot)).is.false;
    });
  });

  describe('the model', () => {
    it('carries the action to the viewer with the same fields a party action has, the preview priced for THAT seat', () => {
      const [game, p1, p2, parliament] = enacted();
      setInfluence(parliament, p1, 2);
      setInfluence(parliament, p2, 0);
      const model = getParliamentModel(game, p1)!;
      expect(model.viewer?.resolutionAction).deep.eq({
        resolution: TRADE_INDUSTRIES_ID, party: PartyName.UNITY, hasAccess: true, usesLeft: 1, usesPerGeneration: 1, available: true, reason: '',
        preview: TRADE_INDUSTRIES.action!.preview(p1),
      });
      expect(model.viewer?.resolutionAction?.preview[0].amount).eq(8);
      expect(getParliamentModel(game, p2)!.viewer?.resolutionAction?.preview[0].amount, 'the other seat pays its own price').eq(12);
      expect(model.viewer?.partyActions.length, 'the party actions are still listed beside it').greaterThan(0);
      expect(getParliamentModel(game)!.viewer, 'no viewer, no verdicts').is.undefined;
    });

    it('the vote from the reserve still pays through the same deferred bill, untouched by the law\'s own bill', () => {
      const [game, p1, , parliament] = enacted();
      const slot = parliament.slots[0];
      parliament.placeVote(p1, slot, 'lobby');
      p1.titanium = 0;
      const vote = ParliamentHandler.voteOption(p1)!;
      expect(vote.votePrompt?.source).eq('reserve');
      vote.cb(parliament.resolutionOf(slot.instance).party);
      runAllActions(game);
      expect(billOf(p1), 'the vote\'s bill is not the law\'s').is.undefined;
      expect(slot.votes.map((v) => v.owner)).deep.eq([p1.id, p1.id]);
      expect(p1.colonies.getFleetSize(), 'no fleet from a vote').eq(1);
    });

    it('the tableau grant of a fleet (`addTradeFleet` — Sky Docks) still lands through the same engine call', () => {
      const [game, p1] = enacted();
      p1.playCard(new SkyDocks());
      runAllActions(game);
      expect(p1.tableau.has(CardName.SKY_DOCKS)).is.true;
      expect(p1.colonies.getFleetSize()).eq(2);
    });
  });
});
