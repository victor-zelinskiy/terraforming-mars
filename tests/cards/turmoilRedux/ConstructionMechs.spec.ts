import {expect} from 'chai';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {MECHS_VALUE} from '../../../src/common/constants';
import {DEFAULT_PAYMENT_VALUES, Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {METAL_RESEARCH_ID} from '../../../src/server/parliament/resolutions/industrialists/MetalResearch';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {SelectPaymentDeferred} from '../../../src/server/deferredActions/SelectPaymentDeferred';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {AdvancedAlloys} from '../../../src/server/cards/base/AdvancedAlloys';
import {CityStandardProject} from '../../../src/server/cards/base/standardProjects/CityStandardProject';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {cast} from '../../../src/common/utils/utils';
import {
  endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution, settleParliamentGates,
} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR17 — CONSTRUCTION MECHS: TR09 EVA Mechs' twin for Building / City tags —
 * the SECOND payment pool of one card resource (`constructionMechs`), and the
 * set's second card with a PARTY REQUIREMENT (Mars First, the TR15 class).
 *
 * Every rule reading of the card file's header is pinned here; the two-pool
 * cases (EVA + Construction in one tableau, one Space+Building play paying
 * from both) are this card's own.
 */
describe('ConstructionMechs', () => {
  let card: ConstructionMechs;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new ConstructionMechs();
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    player.playedCards.push(card);
  });

  const tagged = (name: string, cost: number, tags: Array<Tag>) => fakeCard({name: name as CardName, cost, tags});
  const buildingCard = (cost: number) => tagged(`Building ${cost}`, cost, [Tag.BUILDING]);
  const cityCard = (cost: number) => tagged(`City ${cost}`, cost, [Tag.CITY]);
  const spaceCard = (cost: number) => tagged(`Space ${cost}`, cost, [Tag.SPACE]);

  it('registers with source-backed metadata (the scan: 7 · Building · blue · Mars First · mech · no VP)', () => {
    expect(card.name).eq(CardName.CONSTRUCTION_MECHS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(7);
    // The Mars First emblem sits in the MIN plate — the requirement; the corner holds the only tag.
    expect(card.tags).deep.eq([Tag.BUILDING]);
    expect(card.resourceType).eq(CardResource.MECH);
    expect(card.metadata.cardNumber).eq('TR17');
    expect(card.requirements).has.lengthOf(1);
    expect(card.requirements[0]).to.include({party: PartyName.MARS});
    expect(card.victoryPoints).is.undefined;
    // A payment unit, not a trigger: no card-played hook, no forecast twin.
    const hooks = card as unknown as {onCardPlayed?: unknown, cardPlayedForecast?: unknown};
    expect(hooks.onCardPlayed).is.undefined;
    expect(hooks.cardPlayedForecast).is.undefined;
  });

  describe('rule 7 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    let parliament: Parliament;

    beforeEach(() => {
      game.phase = Phase.ACTION;
      parliament = game.parliament!;
      ([PartyName.GREENS, PartyName.MARS, PartyName.INDUSTRIALISTS] as const)
        .forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      player.playedCards.remove(card);
      player.cardsInHand.push(card);
      player.megaCredits = 20;
    });

    it('neither road: unplayable, and the reason is the NAMED party requirement «0 of 2»', () => {
      expect(player.canPlay(card)).is.false;
      expect(unplayableReasons(player, card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [PartyName.MARS, '2'], party: PartyName.MARS, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on its resolution: still unplayable, «1 of 2»', () => {
      parliament.placeVote(player, parliament.slots[1], 'reserve');
      expect(player.canPlay(card)).is.false;
      expect(unplayableReasons(player, card)[0]).deep.include({party: PartyName.MARS, current: 1});
    });

    it('two delegates on its resolution: playable', () => {
      parliament.placeVote(player, parliament.slots[1], 'reserve');
      parliament.placeVote(player, parliament.slots[1], 'lobby');
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });

    it('Mars First rules: playable with no delegate anywhere', () => {
      seatEnacted(parliament, quietResolutionOf(PartyName.MARS));
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(player.canPlay(card)).is.true;
    });

    it('checked at the PLAY only: once on the table, the action and the payment work whoever rules', () => {
      player.cardsInHand = [];
      player.playedCards.push(card);
      expect(parliament.rulingParty()).not.eq(PartyName.MARS);
      player.energy = 1;
      expect(card.canAct(player)).is.true;
      card.resourceCount = 1;
      expect(player.paymentOptionsForCard(buildingCard(5)).constructionMechs).is.true;
    });
  });

  describe('rule 6 — the action: pay 1 energy, store 1 mech', () => {
    it('is unavailable without energy, and the automatic reason names energy', () => {
      player.energy = 0;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).deep.eq([{type: 'resource', message: 'Not enough energy', resource: 'energy', current: 0}]);
    });

    it('spends exactly 1 energy and stores exactly 1 mech ON THIS CARD, through the real blue-action door', () => {
      player.energy = 1;
      player.megaCredits = 7;
      player.steel = 2;
      const door = cast(player.playActionCard(), SelectCard);
      expect(door.cards.map((c) => c.name)).to.include(CardName.CONSTRUCTION_MECHS);
      door.cb([card]);
      runAllActions(game);
      expect(player.energy).eq(0);
      expect(card.resourceCount).eq(1);
      expect(player.getSpendable('constructionMechs')).eq(1);
      expect([player.megaCredits, player.steel]).deep.eq([7, 2]);
    });

    it('the preview is DECLARATIVE: a 1-energy cost chip and a +1 mech gain chip «on this card»', () => {
      player.energy = 2;
      const preview = actionPreview(player, card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      const effects = preview.branches[0].effects;
      expect(effects.find((e) => e.direction === 'cost')).deep.include({icon: 'energy', amount: 1, current: 2, resulting: 1});
      expect(effects.find((e) => e.direction === 'gain')).deep.include({icon: 'mech', amount: 1, current: 0, resulting: 1, note: 'on this card'});
    });
  });

  describe('the payment source — constructionMechs', () => {
    beforeEach(() => {
      card.resourceCount = 3;
      player.megaCredits = 0;
      player.steel = 0;
      player.titanium = 0;
    });

    it('is wired as its OWN spendable unit bound to THIS card, at the shared flat value', () => {
      expect(SPENDABLE_CARD_RESOURCES).to.include('constructionMechs');
      expect(CARD_FOR_SPENDABLE_RESOURCE.constructionMechs).eq(CardName.CONSTRUCTION_MECHS);
      expect(DEFAULT_PAYMENT_VALUES.constructionMechs).eq(MECHS_VALUE);
      expect(player.getSpendable('constructionMechs')).eq(3);
      // EVA's unit is untouched: this card's mechs are not EVA's.
      expect(player.getSpendable('mechs')).eq(0);
    });

    it('rule 1 — the option is exactly «a Building OR a City tag»', () => {
      expect(player.paymentOptionsForCard(buildingCard(10)).constructionMechs).is.true;
      expect(player.paymentOptionsForCard(cityCard(10)).constructionMechs).is.true;
      expect(player.paymentOptionsForCard(tagged('City+Building', 10, [Tag.CITY, Tag.BUILDING])).constructionMechs).is.true;
      expect(player.paymentOptionsForCard(spaceCard(10)).constructionMechs).is.false;
      expect(player.paymentOptionsForCard(fakeCard({cost: 10, tags: []})).constructionMechs).is.false;
      // Last Resort Ingenuity opens steel and titanium — its text never names mechs.
      player.lastCardPlayed = CardName.LAST_RESORT_INGENUITY;
      const plain = fakeCard({cost: 10, tags: []});
      expect(player.paymentOptionsForCard(plain).steel).is.true;
      expect(player.paymentOptionsForCard(plain).constructionMechs).is.false;
    });

    it('rule 1 — the City STANDARD PROJECT has no tag: the mechs never pay it', () => {
      const city = new CityStandardProject();
      expect(player.paymentOptionsForCard(city).constructionMechs).is.false;
      card.resourceCount = 10; // 50 M€ worth — and still not money for the project
      expect(city.canAct(player)).is.false;
      expect(player.payingAmount(Payment.of({constructionMechs: 5}), city.canPlayOptions(player))).eq(0);
    });

    it('rule 1 — a DEFERRED bill never offers them: the model states the count and refuses the option', () => {
      player.steel = 1;
      player.megaCredits = 3;
      const model = new SelectPaymentDeferred(player, 6, {canUseSteel: true}).previewPaymentModel();
      expect(model, 'steel makes it a real question').is.not.undefined;
      expect(model?.paymentOptions.constructionMechs).is.false;
      expect(model?.constructionMechs).eq(3);
    });

    it('the play prompt\'s model carries the spendable count', () => {
      const building = buildingCard(4);
      player.cardsInHand.push(building);
      expect(new SelectProjectCardToPlay(player, [building]).toModel(player).constructionMechs).eq(3);
    });

    it('a Building card and a City card are playable on mechs alone; a Space card is short of M€', () => {
      card.resourceCount = 2;
      const building = buildingCard(10);
      const city = cityCard(10);
      const space = spaceCard(10);
      player.cardsInHand.push(building, city, space);
      expect(player.canPlay(building)).is.true;
      expect(player.canPlay(city)).is.true;
      expect(player.canPlay(space)).is.false;
      expect(unplayableReasons(player, space)).deep.eq([{type: 'megacredits', message: 'Need ${0} more M€', params: ['10']}]);
    });

    it('a City-tag play spends the mechs off THIS card through checkPaymentAndPlayCard', () => {
      player.megaCredits = 2;
      const city = cityCard(12);
      player.cardsInHand.push(city);
      player.checkPaymentAndPlayCard(city, Payment.of({megacredits: 2, constructionMechs: 2}));
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(player.megaCredits).eq(0);
      expect(player.playedCards.get(city.name)).is.not.undefined;
    });

    it('a mech here does not pay for a Space card, whatever the mix says', () => {
      const space = spaceCard(5);
      player.cardsInHand.push(space);
      expect(() => player.checkPaymentAndPlayCard(space, Payment.of({constructionMechs: 1}))).to.throw(/Did not spend enough/);
    });

    it('pay() deducts from THIS card and records «spent as payment» under its name', () => {
      player.pay(Payment.of({constructionMechs: 2}));
      expect(card.resourceCount).eq(1);
      const record = game.events.events.find((e) => e.impact.cardResourcesSpentAsPayment !== undefined);
      expect(record?.source).deep.eq({kind: 'card', card: CardName.CONSTRUCTION_MECHS, owner: player.color});
      expect(record?.impact.cardResourcesSpentAsPayment).deep.eq([{cardResource: CardResource.MECH, amount: 2}]);
      expect(record?.impact.megacreditsSaved).eq(10);
    });

    it('rule 3 — overpay is the upstream semantic: 2 mechs for a 6 M€ card are legal, both leave, no change', () => {
      card.resourceCount = 2;
      const building = buildingCard(6);
      player.cardsInHand.push(building);
      player.checkPaymentAndPlayCard(building, Payment.of({constructionMechs: 2}));
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(player.megaCredits).eq(0);
    });

    it('rule 8 — steel and mechs on one Building card are two independent lanes', () => {
      player.steel = 2;
      const building = buildingCard(9);
      player.cardsInHand.push(building);
      // 2 steel (4) + 1 mech (5) = 9.
      player.checkPaymentAndPlayCard(building, Payment.of({steel: 2, constructionMechs: 1}));
      runAllActions(game);
      expect(player.steel).eq(0);
      expect(card.resourceCount).eq(2);
    });

    it('rule 2 — the value is FLAT: Advanced Alloys raises steel, never the mech', () => {
      player.playCard(new AdvancedAlloys());
      expect(player.getSteelValue()).eq(3);
      expect(player.payingAmount(Payment.of({constructionMechs: 1}), {constructionMechs: true})).eq(5);
      expect(player.payingAmount(Payment.of({steel: 1}), {steel: true})).eq(3);
    });

    it('rule 2 — Metal Research (RX19) raises steel — and leaves the mech at 5; the forecast states the same 5', () => {
      const parliament = game.parliament;
      if (!(parliament instanceof Parliament)) {
        throw new Error('a Redux table has a parliament');
      }
      const metal = resolutionInstanceId(METAL_RESEARCH_ID, 0);
      seatResolution(parliament, 0, metal);
      parliament.placeVote(player, parliament.slots[0], 'lobby');
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.enacted).eq(metal);
      expect(player.getSteelValue()).eq(3);
      expect(player.payingAmount(Payment.of({constructionMechs: 1}), {constructionMechs: true})).eq(5);
      const building = buildingCard(10);
      player.cardsInHand.push(building);
      const forecast = effectForecastForPlay(player, building, cardPlayPreview(player, building));
      expect(forecast.paymentValues.find((v) => v.resource === CardResource.MECH)).deep.eq({
        source: {kind: 'card', card: CardName.CONSTRUCTION_MECHS, owner: player.color},
        resource: CardResource.MECH, value: 5, count: 3,
      });
    });
  });

  describe('rule 4 — two pools of one resource: EVA Mechs and Construction Mechs', () => {
    let eva: EvaMechs;

    beforeEach(() => {
      eva = new EvaMechs();
      player.playedCards.push(eva);
      eva.resourceCount = 2;
      card.resourceCount = 3;
      player.megaCredits = 0;
      player.steel = 0;
      player.titanium = 0;
    });

    it('each unit reads ITS card; a Space card opens EVA\'s, a Building card this one\'s, a Space+Building card both', () => {
      expect(player.getSpendable('mechs')).eq(2);
      expect(player.getSpendable('constructionMechs')).eq(3);
      const space = player.paymentOptionsForCard(spaceCard(10));
      expect([space.mechs, space.constructionMechs]).deep.eq([true, false]);
      const building = player.paymentOptionsForCard(buildingCard(10));
      expect([building.mechs, building.constructionMechs]).deep.eq([false, true]);
      const both = player.paymentOptionsForCard(tagged('Space+Building', 10, [Tag.SPACE, Tag.BUILDING]));
      expect([both.mechs, both.constructionMechs]).deep.eq([true, true]);
    });

    it('a Space+Building play paid from BOTH pools: each card loses its own, and the sum covers the price', () => {
      const elevator = tagged('Space+Building', 25, [Tag.SPACE, Tag.BUILDING]);
      player.cardsInHand.push(elevator);
      expect(player.canPlay(elevator), '5 mechs × 5 = 25').is.true;
      player.checkPaymentAndPlayCard(elevator, Payment.of({mechs: 2, constructionMechs: 3}));
      runAllActions(game);
      expect(eva.resourceCount).eq(0);
      expect(card.resourceCount).eq(0);
      const records = game.events.events.filter((e) => e.impact.cardResourcesSpentAsPayment !== undefined);
      expect(records.map((e) => [e.source?.kind === 'card' ? e.source.card : undefined, e.impact.megacreditsSaved]))
        .to.have.deep.members([[CardName.EVA_MECHS, 10], [CardName.CONSTRUCTION_MECHS, 15]]);
    });

    it('a unit is bounded by ITS card: 3 EVA mechs are not spendable when EVA holds 2', () => {
      expect(player.canSpend(Payment.of({mechs: 3}))).is.false;
      expect(player.canSpend(Payment.of({mechs: 2, constructionMechs: 3}))).is.true;
      expect(player.canSpend(Payment.of({constructionMechs: 4}))).is.false;
    });

    it('Mech Sports\' mechs are no money at all — neither pool counts them', () => {
      const sports = new MechSports();
      player.playedCards.push(sports);
      sports.resourceCount = 4;
      expect(player.getSpendable('mechs')).eq(2);
      expect(player.getSpendable('constructionMechs')).eq(3);
    });
  });

  it('rule 5 — a Vesta trade may put its mechs HERE, and they become money for Building / City', () => {
    const vesta = new Vesta();
    game.phase = Phase.ACTION;
    game.colonies = [vesta];
    // A second holder, so the pick is a real question (one holder takes the units unasked).
    const eva = new EvaMechs();
    player.playedCards.push(eva);
    vesta.trackPosition = 6; // the 7th cell: 3 units
    vesta.trade(player);
    runAllActions(game);
    const pick = cast(player.popWaitingFor(), SelectCard);
    expect(pick.cards.map((c) => c.name)).to.have.members([CardName.EVA_MECHS, CardName.CONSTRUCTION_MECHS]);
    pick.cb([card]);
    runAllActions(game);
    expect(card.resourceCount).eq(3);
    expect(eva.resourceCount).eq(0);
    expect(player.getSpendable('constructionMechs')).eq(3);
    expect(player.payingAmount(Payment.of({constructionMechs: 3}), player.paymentOptionsForCard(buildingCard(15)))).eq(15);
  });

  describe('save / reload', () => {
    it('the stored mechs survive serialization and are spendable again', () => {
      card.resourceCount = 2;
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id);
      const reloadedCard = again.playedCards.get(CardName.CONSTRUCTION_MECHS) as IProjectCard | undefined;
      expect(reloadedCard?.resourceCount).eq(2);
      expect(again.getSpendable('constructionMechs')).eq(2);
    });
  });
});
