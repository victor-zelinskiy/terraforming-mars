import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  METAL_RESEARCH, METAL_RESEARCH_CODE, METAL_RESEARCH_ID, METAL_RESEARCH_STEEL, METAL_RESEARCH_TITANIUM, METAL_RESEARCH_VALUE_BONUS,
  metalResearchValueBonus,
} from '../../src/server/parliament/resolutions/industrialists/MetalResearch';
import {DEVELOPMENT_CRAZE_STEEL} from '../../src/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {JOVIAN_TAX_RIGHTS_TITANIUM} from '../../src/server/parliament/resolutions/unity/JovianTaxRights';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {HEAT_CAPTURE_ID} from '../../src/server/parliament/resolutions/reds/HeatCapture';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {Server} from '../../src/server/models/ServerModel';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {Payment} from '../../src/common/inputs/Payment';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem, isICardRenderProductionBox} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {AdvancedAlloys} from '../../src/server/cards/base/AdvancedAlloys';
import {Mine} from '../../src/server/cards/base/Mine';
import {NuclearPower} from '../../src/server/cards/base/NuclearPower';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';

/**
 * METAL RESEARCH (Turmoil Redux, RX19) — steel = influence AND titanium =
 * influence for every participant (two steps, two records), and while the
 * card stands enacted a passive that changes the VALUE OF A RESOURCE: each
 * unit of steel and titanium is worth 1 M€ more.
 *
 * What these specs pin: the two payouts are the family's own rows word for
 * word, each seat by its own influence, influence 0 → TWO named skips; the
 * value is added ON THE READ of the accessors (steel 2 → 3, titanium 3 → 4)
 * and never written into the player's serialized value field — a save from
 * under the law keeps 2 / 3 in the field while the accessor still reads 3 / 4
 * (the spec that catches the forbidden implementation); it stacks additively
 * with Advanced Alloys (4 / 5), ends with the law, is read by `payingAmount`,
 * agreed with by `canAfford` and by `spendableMegacredits` (the raw reader
 * that once bypassed the accessor), applied before the Luna Trade Federation
 * −1, and never MarsBot's; the passive states no forecast fact (its twin is
 * the rate); the price breakdown is untouched (a value is not a discount).
 */
const METAL = resolutionInstanceId(METAL_RESEARCH_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Metal Research in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, METAL);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
}

/** The card ENACTED by a real sitting, the next generation's action phase open. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = stage();
  endGenerationThroughParliament(game);
  runAllActions(game);
  settleParliamentGates(game);
  game.phase = Phase.ACTION;
  expect(parliament.enacted).eq(METAL);
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
  settleParliamentGates(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function recordsOf(parliament: Parliament, player: TestPlayer): Array<SerializedEnactOutcome> {
  return (parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: string): SerializedEnactOutcome | undefined {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

/** The serialized value FIELDS of a player — what the save carries, never the accessor. */
function savedValuesOf(game: IGame, player: TestPlayer): {steel: number, titanium: number} {
  const saved = game.serialize().players.find((p) => p.id === player.id)!;
  return {steel: saved.steelValue, titanium: saved.titaniumValue};
}

describe('MetalResearch', () => {
  describe('the catalog entry', () => {
    it('is RX19 of the Industrialists — one copy, no expansion needed, the +1 titanium production quest, nothing for the winner or the world', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(METAL_RESEARCH_ID)).eq(METAL_RESEARCH);
      expect(METAL_RESEARCH_CODE).eq('RX19');
      expect(METAL_RESEARCH_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX19')).eq(METAL_RESEARCH);
      expect(METAL_RESEARCH.party).eq(PartyName.INDUSTRIALISTS);
      expect(METAL_RESEARCH.copies).eq(1);
      expect(METAL_RESEARCH.compatibility, 'steel and titanium are the base game\'s').is.undefined;
      expect(METAL_RESEARCH.quest).deep.eq({goal: {kind: 'production', resource: Resource.TITANIUM}, count: 1});
      expect(METAL_RESEARCH.winnerSteps, 'no winner-only part — «when enacted», not «the winner»').is.undefined;
      expect(METAL_RESEARCH.winnerReward).is.undefined;
      expect(METAL_RESEARCH.worldSteps).is.undefined;
      expect(METAL_RESEARCH.worldMoves).is.undefined;
      expect(METAL_RESEARCH.levy).is.undefined;
    });

    it('declares the two payouts as the family\'s own rows WORD FOR WORD — Development Craze\'s steel, Jovian Tax Rights\' titanium — and two steps in the printed order', () => {
      expect(METAL_RESEARCH.scaled).deep.eq([METAL_RESEARCH_STEEL, METAL_RESEARCH_TITANIUM]);
      expect(METAL_RESEARCH_STEEL).deep.eq(DEVELOPMENT_CRAZE_STEEL);
      expect(METAL_RESEARCH_TITANIUM).deep.eq(JOVIAN_TAX_RIGHTS_TITANIUM);
      expect(METAL_RESEARCH.immediateSteps?.map((s) => s.key)).deep.eq(['steel', 'titanium']);
      expect(METAL_RESEARCH.text.effect).eq('Gain 1 steel and 1 titanium for every point of your influence.');
    });

    it('declares its PASSIVE as a VALUE BONUS hook — steel and titanium, 1 M€ each, nothing else — with its text and its (fact-free) forecast', () => {
      const [, p1] = reduxGame();
      expect(METAL_RESEARCH.passive?.resourceValueBonus).eq(metalResearchValueBonus);
      expect(METAL_RESEARCH.passive?.cardDiscount, 'a value is not a discount').is.undefined;
      expect(METAL_RESEARCH.passive?.onTilePlaced).is.undefined;
      expect(METAL_RESEARCH.text.passive).eq('Each unit of your steel and titanium is worth 1 M€ more.');
      expect(METAL_RESEARCH_VALUE_BONUS).eq(1);
      expect(metalResearchValueBonus(p1, Resource.STEEL)).eq(1);
      expect(metalResearchValueBonus(p1, Resource.TITANIUM)).eq(1);
      for (const other of [Resource.MEGACREDITS, Resource.PLANTS, Resource.ENERGY, Resource.HEAT]) {
        expect(metalResearchValueBonus(p1, other), other).eq(0);
      }
    });

    it('the face prints «[steel][titanium] / [influence]» and the passive as «[steel][titanium] : +1 M€»; the quest graphic is a titanium PRODUCTION box', () => {
      const [formula, effect] = METAL_RESEARCH.renderData.rows;
      const items = formula.filter(isICardRenderItem).map((item) => item.type);
      expect(items).deep.eq([CardRenderItemType.STEEL, CardRenderItemType.TITANIUM, CardRenderItemType.INFLUENCE]);
      expect(effect.length, 'the passive is its own drawing on the second row').eq(1);
      const [quest] = questRenderData(METAL_RESEARCH.quest).rows;
      const box = quest.find(isICardRenderProductionBox);
      expect(box, 'a production frame, not a bare resource').is.not.undefined;
      expect(box!.rows[0].filter(isICardRenderItem).map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.TITANIUM, 1]]);
    });

    it('the shared formula: 1 per point of influence on each part, nothing below zero', () => {
      for (const effect of [METAL_RESEARCH_STEEL, METAL_RESEARCH_TITANIUM]) {
        expect(scaledAmount(effect, 0)).eq(0);
        expect(scaledAmount(effect, 1)).eq(1);
        expect(scaledAmount(effect, 3)).eq(3);
        expect(scaledAmount(effect, 5), 'no cap').eq(5);
      }
    });

    it('the stand opens the INFLUENCE family from the declaration alone — two supply parts by influence, no count, no cap', () => {
      expect(familyOf(METAL_RESEARCH)).eq('influence');
    });
  });

  describe('the enactment — steel, then titanium, for every participant', () => {
    it('p1 (influence 3) gets 3 steel and 3 titanium, p2 (influence 1) 1 and 1 — TWO records per seat in the printed order, the events and the journal', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3.
      parliament.agenda.set(p1.id, 4);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.enacted).eq(METAL);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq(['steel', 'titanium']);
      expect(recordsOf(parliament, p2).map((o) => o.step)).deep.eq(['steel', 'titanium']);
      expect(outcomeOf(parliament, p1, 'steel')).deep.eq({player: p1.id, step: 'steel', part: 'effect', kind: 'stock', effect: 'steel', stock: Resource.STEEL, amount: 3, influence: 3, before: 0, after: 3});
      expect(outcomeOf(parliament, p1, 'titanium')).deep.eq({player: p1.id, step: 'titanium', part: 'effect', kind: 'stock', effect: 'titanium', stock: Resource.TITANIUM, amount: 3, influence: 3, before: 0, after: 3});
      expect(outcomeOf(parliament, p2, 'steel')).deep.include({kind: 'stock', amount: 1, influence: 1, before: 0, after: 1});
      expect(outcomeOf(parliament, p2, 'titanium')).deep.include({kind: 'stock', amount: 1, influence: 1, before: 0, after: 1});
      expect([p1.steel, p1.titanium, p2.steel, p2.titanium]).deep.eq([3, 3, 1, 1]);
      // The events, under the resolution's source, in the printed order.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === METAL_RESEARCH_ID && e.player === p1.color && e.type !== 'action');
      expect(mine.map((e) => e.type)).deep.eq(['resource-changed', 'resource-changed']);
      expect(mine[0].impact?.stock?.steel).eq(3);
      expect(mine[1].impact?.stock?.titanium).eq(3);
      // The journal: the family's own line, once per part, naming the law.
      const lines = game.gameLog.filter((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})' &&
        entry.data.some((d) => d.type === LogMessageDataType.RESOLUTION && d.value === METAL_RESEARCH_ID));
      expect(lines.map((entry) => entry.data.find((d) => d.type === LogMessageDataType.RESOURCE)?.value)).deep.eq([Resource.STEEL, Resource.TITANIUM, Resource.STEEL, Resource.TITANIUM]);
    });

    it('influence 0 pays nothing and NAMES it TWICE — one skip per part, never one shared skip', () => {
      const [game, , p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(0));
      endGeneration(game);
      expect(outcomeOf(parliament, p2, 'steel')).deep.eq({player: p2.id, step: 'steel', part: 'effect', kind: 'skipped', effect: 'steel', stock: Resource.STEEL, amount: 0, influence: 0, reason: 'No influence'});
      expect(outcomeOf(parliament, p2, 'titanium')).deep.eq({player: p2.id, step: 'titanium', part: 'effect', kind: 'skipped', effect: 'titanium', stock: Resource.TITANIUM, amount: 0, influence: 0, reason: 'No influence'});
      expect(p2.steel).eq(0);
      expect(p2.titanium).eq(0);
      expect(game.gameLog.some((entry) => entry.message === '${0} has no influence — no steel from ${1}')).is.true;
      expect(game.gameLog.some((entry) => entry.message === '${0} has no influence — no titanium from ${1}')).is.true;
    });

    it('a neutral winner cancels nothing: every participant is paid by its own influence', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, METAL);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      expect(parliament.enacted).eq(METAL);
      expect([p1.steel, p1.titanium, p2.steel, p2.titanium]).deep.eq([2, 2, 1, 1]);
    });

    it('a reload after the enactment pays nothing again; both records survive the save', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      endGeneration(game);
      const live = reload(game);
      const copy = live.getPlayerById(p1.id);
      expect(copy.steel).eq(3);
      expect(copy.titanium).eq(3);
      settleParliamentGates(live);
      expect(copy.steel).eq(3);
      expect(copy.titanium).eq(3);
      expect(recordsOf(live.parliament!, p1).map((o) => `${o.step}:${o.amount}`)).deep.eq(['steel:3', 'titanium:3']);
    });
  });

  describe('the VALUE — 1 M€ more per unit of steel and titanium while the law stands', () => {
    it('the accessors read 3 / 4 under the law and 2 / 3 without it — the enacted card is read at the query', () => {
      const [, p1, p2, parliament] = reduxGame();
      expect([p1.getSteelValue(), p1.getTitaniumValue()], 'nothing enacted').deep.eq([2, 3]);
      expect(ParliamentHandler.resourceValueBonus(p1, Resource.STEEL)).eq(0);
      parliament.enacted = METAL;
      expect([p1.getSteelValue(), p1.getTitaniumValue()], 'the law stands').deep.eq([3, 4]);
      expect([p2.getSteelValue(), p2.getTitaniumValue()], 'EVERY participant — the seat that did not vote for it too').deep.eq([3, 4]);
      expect(ParliamentHandler.resourceValueBonus(p1, Resource.STEEL)).eq(1);
      expect(ParliamentHandler.resourceValueBonus(p1, Resource.TITANIUM)).eq(1);
      expect(ParliamentHandler.resourceValueBonus(p1, Resource.PLANTS), 'nothing else is touched').eq(0);
      parliament.enacted = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);
      expect([p1.getSteelValue(), p1.getTitaniumValue()], 'the law changed — the bonus ends with it, by the same mechanism that gave it').deep.eq([2, 3]);
      parliament.enacted = undefined;
      expect([p1.getSteelValue(), p1.getTitaniumValue()]).deep.eq([2, 3]);
    });

    it('a game WITHOUT a parliament reads the base values — the query is a no-op there', () => {
      const [, p1] = testGame(2);
      expect(p1.game.parliament).is.undefined;
      expect([p1.getSteelValue(), p1.getTitaniumValue()]).deep.eq([2, 3]);
      expect(ParliamentHandler.resourceValueBonus(p1, Resource.STEEL)).eq(0);
    });

    it('stacks ADDITIVELY with Advanced Alloys: 4 / 5 under the law, back to the card\'s 3 / 4 when the law leaves — the card\'s own step is never lost', () => {
      const [, p1, , parliament] = enacted();
      expect([p1.getSteelValue(), p1.getTitaniumValue()]).deep.eq([3, 4]);
      new AdvancedAlloys().play(p1);
      expect([p1.getSteelValue(), p1.getTitaniumValue()], 'base + the card + the law').deep.eq([4, 5]);
      parliament.enacted = resolutionInstanceId(HEAT_CAPTURE_ID, 0);
      expect([p1.getSteelValue(), p1.getTitaniumValue()], 'the card\'s step stays, the law\'s goes').deep.eq([3, 4]);
    });

    it('THE FIELD IS NEVER WRITTEN: enacting the law does not move the serialized value; a save from under the law keeps 2 / 3 in the field while the copy still reads 3 / 4', () => {
      const [game, p1, p2] = enacted();
      expect(savedValuesOf(game, p1), 'the player\'s OWN value is what the save carries').deep.eq({steel: 2, titanium: 3});
      expect(savedValuesOf(game, p2)).deep.eq({steel: 2, titanium: 3});
      expect([p1.getSteelValue(), p1.getTitaniumValue()]).deep.eq([3, 4]);
      const live = reload(game);
      const copy = live.getPlayerById(p1.id);
      expect(live.parliament?.enacted).eq(METAL);
      expect([copy.getSteelValue(), copy.getTitaniumValue()], 'the bonus is read again on the copy — never applied a second time').deep.eq([3, 4]);
      expect(savedValuesOf(live, copy as TestPlayer), 'and the copy\'s field is still the player\'s own').deep.eq({steel: 2, titanium: 3});
      // With Advanced Alloys the field carries the CARD's step and nothing of the law's.
      new AdvancedAlloys().play(copy);
      expect(savedValuesOf(live, copy as TestPlayer)).deep.eq({steel: 3, titanium: 4});
      expect([copy.getSteelValue(), copy.getTitaniumValue()]).deep.eq([4, 5]);
    });

    it('`payingAmount` charges by the new rate — on a card and on anything else that accepts the resource', () => {
      const [, p1, , parliament] = enacted();
      expect(p1.payingAmount(Payment.of({steel: 2}), {steel: true}), '2 steel = 6').eq(6);
      expect(p1.payingAmount(Payment.of({titanium: 2}), {titanium: true}), '2 titanium = 8').eq(8);
      expect(p1.payingAmount(Payment.of({steel: 1, titanium: 1, megacredits: 1}), {steel: true, titanium: true})).eq(3 + 4 + 1);
      expect(p1.payingAmount(Payment.of({steel: 2}), {steel: false}), 'a payment that does not accept steel is not charged for it').eq(0);
      parliament.enacted = undefined;
      expect(p1.payingAmount(Payment.of({steel: 2}), {steel: true})).eq(4);
      expect(p1.payingAmount(Payment.of({titanium: 2}), {titanium: true})).eq(6);
    });

    it('`canAfford` agrees with `payingAmount`: 4 steel and no M€ afford a 12 M€ Building card under the law, not without it', () => {
      const [, p1, , parliament] = enacted();
      p1.megaCredits = 0;
      p1.steel = 4;
      expect(p1.canAfford({cost: 12, steel: true}), '4 × 3 = 12').is.true;
      expect(p1.canAfford({cost: 13, steel: true})).is.false;
      p1.titanium = 3;
      expect(p1.canAfford({cost: 12, titanium: true}), '3 × 4 = 12').is.true;
      expect(p1.canAfford({cost: 24, steel: true, titanium: true}), '12 + 12').is.true;
      parliament.enacted = undefined;
      expect(p1.canAfford({cost: 12, steel: true}), '4 × 2 = 8').is.false;
      expect(p1.canAfford({cost: 12, titanium: true}), '3 × 3 = 9').is.false;
    });

    it('PLAYING a card pays the steel at 3: Nuclear Power (10, a Building tag) for 4 steel and no M€ — refused without the law', () => {
      const [game, p1, , parliament] = enacted();
      p1.megaCredits = 0;
      p1.steel = 4;
      const withoutLaw = parliament.enacted;
      parliament.enacted = undefined;
      expect(() => p1.checkPaymentAndPlayCard(new NuclearPower(), Payment.of({steel: 4})), '4 × 2 = 8 < 10').throws(/Did not spend enough/);
      parliament.enacted = withoutLaw;
      p1.checkPaymentAndPlayCard(new NuclearPower(), Payment.of({steel: 4}));
      runAllActions(game);
      expect(p1.steel).eq(0);
      expect(p1.megaCredits).eq(0);
      expect(p1.playedCards.has(CardName.NUCLEAR_POWER)).is.true;
      const payment = game.events.serialize().events.find((e) => e.type === 'payment');
      expect(payment?.impact.megacreditsPaid, 'the payment record is the price, whatever it was paid with').eq(10);
    });

    it('`spendableMegacredits` agrees with both — the raw read of the field that once bypassed the law (the Luna Trade Federation branch)', () => {
      const [, p1, , parliament] = enacted();
      p1.megaCredits = 5;
      p1.titanium = 2;
      p1.canUseTitaniumAsMegacredits = true;
      expect(p1.spendableMegacredits(), '5 + 2 × (4 − 1)').eq(11);
      expect(p1.payingAmount(Payment.of({titanium: 2, megacredits: 5}), {titanium: false}), 'the price function reads the same 3 per titanium').eq(11);
      expect(p1.canAfford({cost: 11}), 'the affordability check agrees').is.true;
      expect(p1.canAfford({cost: 12})).is.false;
      parliament.enacted = undefined;
      expect(p1.spendableMegacredits(), '5 + 2 × (3 − 1)').eq(9);
      expect(p1.payingAmount(Payment.of({titanium: 2, megacredits: 5}), {titanium: false})).eq(9);
    });

    it('the Luna Trade Federation branch applies AFTER the value: titanium outside a Space card pays 4 − 1 = 3, on a Space card the full 4', () => {
      const [, p1] = enacted();
      p1.canUseTitaniumAsMegacredits = true;
      expect(p1.payingAmount(Payment.of({titanium: 1}), {titanium: false}), 'a non-Space card: value − 1').eq(3);
      expect(p1.payingAmount(Payment.of({titanium: 1}), {titanium: true}), 'a Space card: the value').eq(4);
      expect(p1.payingAmount(Payment.of({titanium: 1}), p1.paymentOptionsForCard(new Mine()))).eq(3);
      expect(p1.payingAmount(Payment.of({titanium: 1}), p1.paymentOptionsForCard(new SecurityFleet()))).eq(4);
    });

    it('a VALUE is not a DISCOUNT: the price breakdown is untouched — no line of the law, the printed price stands, the forecast\'s discount group is empty', () => {
      const [, p1] = enacted();
      const mine = p1.getCardCostBreakdown(new Mine());
      expect(mine.final).eq(mine.base);
      expect(mine.discounts).deep.eq([]);
      expect(ParliamentHandler.cardDiscount(p1, new Mine())).is.undefined;
      const power = new NuclearPower();
      const forecast = effectForecastForPlay(p1, power, cardPlayPreview(p1, power));
      expect(forecast.discounts).deep.eq({base: 10, final: 10, items: [], other: 0});
      expect(allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution'), 'no fact of the law on a play').deep.eq([]);
    });

    it('the passive\'s own forecast states nothing (its twin is the rate where the decision is made)', () => {
      const [, p1] = enacted();
      expect(METAL_RESEARCH.passive?.forecast({
        player: p1, grants: [], tiles: [],
        source: (channel) => ({kind: 'resolution', name: METAL_RESEARCH_ID, owner: p1.color, channel}),
        exact: () => {
          throw new Error('not called');
        },
        deferred: () => {
          throw new Error('not called');
        },
        stockGain: () => ({direction: 'gain', icon: 'megacredits', amount: 0}),
        productionChange: () => ({direction: 'gain', icon: 'megacredits', amount: 0}),
        drawGain: () => ({direction: 'gain', icon: 'cards', amount: 0}),
      })).deep.eq([]);
    });

    it('the client model carries the LIVE value — 3 / 4 for every participant under the law — so the rail badge and the payment panel read it with no code of their own', () => {
      const [, p1, p2, parliament] = enacted();
      for (const seat of [p1, p2]) {
        const model = Server.getPlayer(seat, true);
        expect([model.steelValue, model.titaniumValue], seat.color).deep.eq([3, 4]);
      }
      parliament.enacted = undefined;
      const model = Server.getPlayer(p1, true);
      expect([model.steelValue, model.titaniumValue]).deep.eq([2, 3]);
    });
  });

  describe('the chairman quest — raise your titanium production 1 step', () => {
    /** A production raised by the player's OWN action (the engine's standard raise under an action scope). */
    function raiseAsAction(player: TestPlayer, resource: Resource, steps: number): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.MINE, owner: player.color}, {category: 'card-play'});
      try {
        player.production.add(resource, steps, {log: false});
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('the enactment\'s own steel and titanium (supply, not production) move no progress; a steel step does not; the player\'s OWN titanium step completes it', () => {
      const [game, p1, , parliament] = enacted();
      expect(parliament.quest?.source).eq(METAL_RESEARCH_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'production', resource: Resource.TITANIUM}, count: 1});
      expect(parliament.questProgressOf(p1), 'the law paid supply, not production').eq(0);
      raiseAsAction(p1, Resource.STEEL, 2);
      expect(parliament.questProgressOf(p1), 'steel is not titanium').eq(0);
      raiseAsAction(p1, Resource.TITANIUM, 1);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot is never paid and holds no value bonus — the human does; the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, METAL);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor(), 'the bot is never asked a political question').is.undefined;
      settleParliamentGates(game);
      expect(parliament.phase, 'nothing of this card asks anything — the sitting closes on its own').is.undefined;
      expect(parliament.enacted).eq(METAL);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id), 'the bot is never a recipient').is.false;
      expect(bot.steel).eq(0);
      expect(bot.titanium).eq(0);
      expect([bot.getSteelValue(), bot.getTitaniumValue()], 'the bot holds no law').deep.eq([2, 3]);
      expect(ParliamentHandler.resourceValueBonus(bot, Resource.STEEL)).eq(0);
      expect([human.getSteelValue(), human.getTitaniumValue()], 'the human does').deep.eq([3, 4]);
    });

    it('the records reach every viewer with both parts', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      for (const viewer of [p1, p2]) {
        const outcomes = getParliamentModel(game, viewer)?.lastPhase?.outcomes ?? [];
        const mine = outcomes.filter((o) => o.player === p1.color && o.kind === 'stock');
        expect(mine.map((o) => `${o.step}:${o.amount}`), `viewer ${viewer.color}`).deep.eq(['steel:3', 'titanium:3']);
      }
    });

    it('once enacted, the INDUSTRIALISTS rule', () => {
      const [game, , , parliament] = stage();
      endGeneration(game);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
    });
  });
});
