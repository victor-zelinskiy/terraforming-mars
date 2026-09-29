import {expect} from 'chai';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
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
import {MECHS_VALUE} from '../../../src/common/constants';
import {DEFAULT_PAYMENT_VALUES, Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {METAL_RESEARCH_ID} from '../../../src/server/parliament/resolutions/industrialists/MetalResearch';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {SelectPaymentDeferred} from '../../../src/server/deferredActions/SelectPaymentDeferred';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR09 — EVA MECHS: the first Turmoil Redux PROJECT card, and the card that
 * introduces the `Mech` card resource + the `mechs` payment unit.
 *
 * Every rule reading of the card file's header is pinned here: the science
 * requirement, the 1-energy action with its automatic reason, the mech as a
 * PAYMENT UNIT (Space-tag card plays only — never a standard project, a
 * deferred bill or Last Resort Ingenuity), the FLAT 5 (no titanium modifier,
 * no Metal Research), the upstream overpay semantic, `pay()` deducting from
 * the CARD and recording the saving, and the resource surviving a save.
 */
describe('EvaMechs', () => {
  let card: EvaMechs;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new EvaMechs();
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    player.playedCards.push(card);
  });

  const spaceCard = (cost: number) => fakeCard({name: `Space ${cost}` as CardName, cost, tags: [Tag.SPACE]});
  const buildingCard = (cost: number) => fakeCard({name: `Building ${cost}` as CardName, cost, tags: [Tag.BUILDING]});
  const scienceTag = () => fakeCard({name: 'A science tag' as CardName, tags: [Tag.SCIENCE]});

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.EVA_MECHS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(6);
    expect(card.tags).deep.eq([Tag.SCIENCE, Tag.SPACE]);
    expect(card.resourceType).eq(CardResource.MECH);
    expect(card.metadata.cardNumber).eq('TR09');
    expect(card.requirements).has.lengthOf(1);
    expect(card.requirements[0]).to.include({tag: Tag.SCIENCE});
    // A payment unit, not a trigger: no card-played hook, no forecast twin.
    const hooks = card as unknown as {onCardPlayed?: unknown, cardPlayedForecast?: unknown};
    expect(hooks.onCardPlayed).is.undefined;
    expect(hooks.cardPlayedForecast).is.undefined;
  });

  describe('the requirement — 1 science tag', () => {
    beforeEach(() => {
      player.playedCards.remove(card);
      player.cardsInHand.push(card);
      player.megaCredits = 20;
    });

    it('is refused without a science tag, and the reason IS the printed requirement', () => {
      expect(player.canPlay(card)).is.false;
      const reasons = unplayableReasons(player, card);
      expect(reasons.some((r) => r.requirement === true), JSON.stringify(reasons)).is.true;
    });

    it('is playable with one science tag', () => {
      player.playedCards.push(scienceTag());
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });

    it('the tag count is the ONE counting function, so the parliament\'s bonuses count too (R&D Funding, the Scientists\' wild tag)', () => {
      // A generic tag-count check — the card declares the requirement through
      // the DSL and never counts by itself. Two science tags on one card
      // satisfy «1 science tag» exactly as one does.
      player.playedCards.push(fakeCard({name: 'Two science tags' as CardName, tags: [Tag.SCIENCE, Tag.SCIENCE]}));
      expect(player.tags.count(Tag.SCIENCE)).eq(2);
      expect(player.canPlay(card)).is.true;
    });
  });

  describe('the action — pay 1 energy, store 1 mech', () => {
    it('is unavailable without energy, and the automatic reason names energy', () => {
      player.energy = 0;
      expect(card.canAct(player)).is.false;
      const reasons = actionUnavailableReasons(player, card);
      expect(reasons).deep.eq([{type: 'resource', message: 'Not enough energy', resource: 'energy', current: 0}]);
    });

    it('spends exactly 1 energy and stores exactly 1 mech ON THIS CARD, touching nothing else', () => {
      player.energy = 1;
      player.megaCredits = 7;
      player.steel = 2;
      player.titanium = 3;
      player.plants = 4;
      player.heat = 5;
      expect(card.canAct(player)).is.true;
      // Through the REAL blue-action door, so the action runs inside its own
      // event scope (a bare `card.action()` has no source and records nothing).
      const door = cast(player.playActionCard(), SelectCard);
      expect(door.cards.map((c) => c.name)).to.include(CardName.EVA_MECHS);
      door.cb([card]);
      runAllActions(game);
      expect(player.energy).eq(0);
      expect(card.resourceCount).eq(1);
      expect(player.getSpendable('mechs')).eq(1);
      expect([player.megaCredits, player.steel, player.titanium, player.plants, player.heat]).deep.eq([7, 2, 3, 4, 5]);
      // The gain is on the event stream (the journal, the stats, the aux rail).
      const gained = game.events.events.filter((e) =>
        (e.impact.cardResources ?? []).some((cr) => cr.target === CardName.EVA_MECHS && cr.amount === 1 && cr.cardResource === CardResource.MECH));
      expect(gained.length, 'one card-resource event for the stored mech').eq(1);
    });

    it('the preview is DECLARATIVE: a 1-energy cost chip and a +1 mech gain chip «on this card»', () => {
      player.energy = 2;
      const preview = actionPreview(player, card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      expect(preview.branches).has.lengthOf(1);
      const effects = preview.branches[0].effects;
      expect(effects.find((e) => e.direction === 'cost')).deep.include({icon: 'energy', amount: 1, current: 2, resulting: 1});
      expect(effects.find((e) => e.direction === 'gain')).deep.include({icon: 'mech', amount: 1, current: 0, resulting: 1, note: 'on this card'});
    });
  });

  describe('the payment source — mechs', () => {
    beforeEach(() => {
      card.resourceCount = 3;
      player.megaCredits = 0;
      player.titanium = 0;
      player.steel = 0;
    });

    it('is wired as a spendable card resource bound to THIS card', () => {
      expect(SPENDABLE_CARD_RESOURCES).to.include('mechs');
      expect(CARD_FOR_SPENDABLE_RESOURCE.mechs).eq(CardName.EVA_MECHS);
      expect(DEFAULT_PAYMENT_VALUES.mechs).eq(MECHS_VALUE);
      expect(MECHS_VALUE).eq(5);
    });

    it('canAfford counts the mechs ONLY with the option, at 5 each', () => {
      expect(player.canAfford({cost: 15, mechs: true})).is.true;
      expect(player.canAfford({cost: 16, mechs: true})).is.false;
      expect(player.canAfford({cost: 5})).is.false;
      expect(player.payingAmount(Payment.of({mechs: 3}), {mechs: true})).eq(15);
      expect(player.payingAmount(Payment.of({mechs: 3}), {})).eq(0);
    });

    it('the option is exactly «a Space tag»: Space yes; Building / no tag no; a standard project no; Last Resort Ingenuity no', () => {
      expect(player.paymentOptionsForCard(spaceCard(10)).mechs).is.true;
      expect(player.paymentOptionsForCard(buildingCard(10)).mechs).is.false;
      expect(player.paymentOptionsForCard(fakeCard({cost: 10, tags: []})).mechs).is.false;
      const standardProject = fakeCard({cost: 10, tags: [], type: CardType.STANDARD_PROJECT});
      expect(player.paymentOptionsForCard(standardProject).mechs).is.false;
      // Last Resort Ingenuity opens steel AND titanium for the next card — its
      // text names those two, never mechs.
      player.lastCardPlayed = CardName.LAST_RESORT_INGENUITY;
      const plain = fakeCard({cost: 10, tags: []});
      expect(player.paymentOptionsForCard(plain).steel).is.true;
      expect(player.paymentOptionsForCard(plain).titanium).is.true;
      expect(player.paymentOptionsForCard(plain).mechs).is.false;
    });

    it('a DEFERRED bill never offers mechs — the model states the count and refuses the option', () => {
      player.titanium = 1;
      player.megaCredits = 3;
      const model = new SelectPaymentDeferred(player, 6, {canUseTitanium: true}).previewPaymentModel();
      expect(model, 'titanium makes it a real question').is.not.undefined;
      expect(model?.paymentOptions.mechs).is.false;
      expect(model?.mechs).eq(3);
    });

    it('the play prompt\'s model carries the spendable count', () => {
      const space = spaceCard(4);
      player.cardsInHand.push(space);
      const model = new SelectProjectCardToPlay(player, [space]).toModel(player);
      expect(model.mechs).eq(3);
    });

    it('canSpend is bounded by the mechs ON THE CARD — a second holder of mechs is not money', () => {
      expect(player.canSpend(Payment.of({mechs: 3}))).is.true;
      expect(player.canSpend(Payment.of({mechs: 4}))).is.false;
      // `Mech` is a full card resource: another card may hold mechs…
      const holder = fakeCard({name: 'Another mech holder' as CardName, resourceType: CardResource.MECH});
      player.playedCards.push(holder);
      player.addResourceTo(holder, {qty: 2, log: false});
      expect(holder.resourceCount).eq(2);
      expect(player.getResourceCards(CardResource.MECH).map((c) => c.name)).to.have.members([CardName.EVA_MECHS, holder.name]);
      // …but only EVA Mechs' are tender.
      expect(player.getSpendable('mechs')).eq(3);
      expect(player.canSpend(Payment.of({mechs: 4}))).is.false;
    });

    it('pay() deducts from the CARD and records the saving as «spent as payment»', () => {
      player.pay(Payment.of({mechs: 2}));
      expect(card.resourceCount).eq(1);
      expect(player.megaCredits).eq(0);
      const record = game.events.events.find((e) => e.impact.cardResourcesSpentAsPayment !== undefined);
      expect(record, 'the payment record').is.not.undefined;
      expect(record?.source).deep.eq({kind: 'card', card: CardName.EVA_MECHS, owner: player.color});
      expect(record?.impact.cardResourcesSpentAsPayment).deep.eq([{cardResource: CardResource.MECH, amount: 2}]);
      expect(record?.impact.megacreditsSaved).eq(10);
    });

    it('a real Space play spends the mix atomically through checkPaymentAndPlayCard (M€ + titanium + mechs)', () => {
      player.megaCredits = 1;
      player.titanium = 1;
      const space = spaceCard(9);
      player.cardsInHand.push(space);
      // 1 M€ + 1 titanium (3) + 1 mech (5) = 9.
      player.checkPaymentAndPlayCard(space, Payment.of({megacredits: 1, titanium: 1, mechs: 1}));
      runAllActions(game);
      expect(card.resourceCount).eq(2);
      expect(player.megaCredits).eq(0);
      expect(player.titanium).eq(0);
      expect(player.playedCards.get(space.name)).is.not.undefined;
    });

    it('overpay is the upstream semantic: 2 mechs for a 6 M€ card are legal, both leave, no change', () => {
      card.resourceCount = 2;
      const space = spaceCard(6);
      player.cardsInHand.push(space);
      player.checkPaymentAndPlayCard(space, Payment.of({mechs: 2}));
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(player.megaCredits).eq(0);
    });

    it('a mech does not pay for a Building card, whatever the mix says', () => {
      const building = buildingCard(5);
      player.cardsInHand.push(building);
      expect(() => player.checkPaymentAndPlayCard(building, Payment.of({mechs: 1}))).to.throw(/Did not spend enough/);
    });

    it('the value is FLAT: a titanium modifier never reaches it', () => {
      player.increaseTitaniumValue();
      expect(player.getTitaniumValue()).eq(4);
      expect(player.payingAmount(Payment.of({mechs: 1}), {mechs: true})).eq(5);
    });

    it('Metal Research (RX19) raises steel and titanium — and leaves the mech at 5', () => {
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
      expect(player.getTitaniumValue()).eq(4);
      expect(player.payingAmount(Payment.of({mechs: 1}), {mechs: true})).eq(5);
      // The forecast's «Скидки и оплата» group states the same flat 5.
      const space = spaceCard(10);
      player.cardsInHand.push(space);
      const forecast = effectForecastForPlay(player, space, cardPlayPreview(player, space));
      expect(forecast.paymentValues.find((v) => v.resource === CardResource.MECH)).deep.eq({
        source: {kind: 'card', card: CardName.EVA_MECHS, owner: player.color},
        resource: CardResource.MECH, value: 5, count: 3,
      });
    });

    it('unplayableReasons: a Space card with 0 M€ and 2 mechs is playable; a Building card is short of M€', () => {
      card.resourceCount = 2;
      const space = spaceCard(10);
      const building = buildingCard(10);
      player.cardsInHand.push(space, building);
      expect(player.canPlay(space)).is.true;
      expect(unplayableReasons(player, space)).deep.eq([]);
      expect(player.canPlay(building)).is.false;
      expect(unplayableReasons(player, building)).deep.eq([{type: 'megacredits', message: 'Need ${0} more M€', params: ['10']}]);
    });
  });

  describe('save / reload', () => {
    it('the stored mechs survive serialization and are spendable again', () => {
      card.resourceCount = 2;
      const serialized = player.serialize();
      expect(serialized.playedCards.find((c) => c.name === CardName.EVA_MECHS)?.resourceCount).eq(2);
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id);
      const reloadedCard = again.playedCards.get(CardName.EVA_MECHS) as IProjectCard | undefined;
      expect(reloadedCard?.resourceCount).eq(2);
      expect(again.getSpendable('mechs')).eq(2);
    });
  });
});
