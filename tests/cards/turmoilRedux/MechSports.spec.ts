import {expect} from 'chai';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {AutomatedConvoys, TradeWithAutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE} from '../../../src/common/inputs/Spendable';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR11 — MECH SPORTS: TR09's action (1 energy → a mech here) on TR08's frame
 * (2 Science tags, Mars, 1 VP per resource here). Nothing new is written —
 * what is new is what the card PROVES about the shared layer: the first VP per
 * MECH, the third mech holder (and the first whose mechs score), and two
 * holders with the same action on one table.
 *
 * Every rule reading of the card file's header is pinned here (rule 7 —
 * MarsBot never plays a project card — is the bot's general contract: the
 * card has no path of its own to pin).
 */
describe('MechSports', () => {
  let card: MechSports;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new MechSports();
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    player.playedCards.push(card);
  });

  const scienceTags = (n: number) => fakeCard({name: `${n} science tags` as CardName, tags: Array(n).fill(Tag.SCIENCE)});
  const spaceCard = (cost: number) => fakeCard({name: `Space ${cost}` as CardName, cost, tags: [Tag.SPACE]});

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.MECH_SPORTS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(7);
    // The scan's two atoms sit in the MIN box — the requirement; the corner planet is the only tag.
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.resourceType).eq(CardResource.MECH);
    expect(card.metadata.cardNumber).eq('TR11');
    expect(card.requirements).has.lengthOf(1);
    expect(card.requirements[0]).to.include({tag: Tag.SCIENCE, count: 2});
    expect(card.victoryPoints).deep.eq({resourcesHere: {}});
    // No trigger: no card-played hook, no forecast twin, no bespoke availability.
    const hooks = card as unknown as {onCardPlayed?: unknown, cardPlayedForecast?: unknown, actionUnavailableReason?: unknown};
    expect(hooks.onCardPlayed).is.undefined;
    expect(hooks.cardPlayedForecast).is.undefined;
    expect(hooks.actionUnavailableReason).is.undefined;
  });

  describe('rule 3 — the requirement: 2 science tags, DSL-only', () => {
    beforeEach(() => {
      player.playedCards.remove(card);
      player.cardsInHand.push(card);
      player.megaCredits = 20;
    });

    it('is refused with 1 science tag, and the reason IS the printed requirement', () => {
      player.playedCards.push(scienceTags(1));
      expect(player.canPlay(card)).is.false;
      const reasons = unplayableReasons(player, card);
      expect(reasons.some((r) => r.requirement === true), JSON.stringify(reasons)).is.true;
    });

    it('is playable with 2 science tags', () => {
      player.playedCards.push(scienceTags(2));
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });

    it('the ONE tag count decides: a wild tag stands in for the second science', () => {
      player.playedCards.push(scienceTags(1), fakeCard({name: 'A wild tag' as CardName, tags: [Tag.WILD]}));
      expect(player.canPlay(card)).is.true;
    });

    it('the Mars tag is an ordinary tag: it never counts as science', () => {
      player.playedCards.push(scienceTags(1), new MechSports());
      expect(player.tags.count(Tag.MARS)).eq(1);
      expect(player.canPlay(card)).is.false;
    });
  });

  describe('rule 1 — the action: pay 1 energy, store 1 mech', () => {
    it('is unavailable without energy, and the automatic reason names energy', () => {
      player.energy = 0;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).deep.eq([{type: 'resource', message: 'Not enough energy', resource: 'energy', current: 0}]);
    });

    it('spends exactly 1 energy and stores exactly 1 mech ON THIS CARD, without a prompt', () => {
      player.energy = 1;
      player.megaCredits = 7;
      expect(card.canAct(player)).is.true;
      // Through the REAL blue-action door, so the action runs inside its own event scope.
      const door = cast(player.playActionCard(), SelectCard);
      expect(door.cards.map(toName)).to.include(CardName.MECH_SPORTS);
      door.cb([card]);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.energy).eq(0);
      expect(player.megaCredits).eq(7);
      expect(card.resourceCount).eq(1);
      const gained = game.events.events.filter((e) =>
        (e.impact.cardResources ?? []).some((cr) => cr.target === CardName.MECH_SPORTS && cr.amount === 1 && cr.cardResource === CardResource.MECH));
      expect(gained.length, 'one card-resource event for the stored mech').eq(1);
    });

    it('the preview is DECLARATIVE: a 1-energy cost chip and a +1 mech gain chip «on this card», no steps', () => {
      player.energy = 2;
      const preview = actionPreview(player, card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      expect(preview.branches).has.lengthOf(1);
      const branch = preview.branches[0];
      expect(branch.effects.find((e) => e.direction === 'cost')).deep.include({icon: 'energy', amount: 1, current: 2, resulting: 1});
      expect(branch.effects.find((e) => e.direction === 'gain')).deep.include({icon: 'mech', amount: 1, current: 0, resulting: 1, note: 'on this card'});
      expect(branch.steps).deep.eq([]);
    });
  });

  describe('rule 2 — victory points', () => {
    it('1 VP per mech here: 0 / 1 / 3 mechs → 0 / 1 / 3', () => {
      for (const n of [0, 1, 3]) {
        card.resourceCount = n;
        expect(card.getVictoryPoints(player), `${n} mechs`).eq(n);
      }
    });
  });

  describe('rule 4 — the mechs here are NOT money (EVA Mechs beside it)', () => {
    let eva: EvaMechs;

    beforeEach(() => {
      eva = new EvaMechs();
      eva.resourceCount = 2;
      card.resourceCount = 3;
      player.playedCards.push(eva);
      player.megaCredits = 0;
      player.titanium = 0;
    });

    it('the payment unit stays bound to EVA Mechs: a Space card is offered exactly EVA\'s 2 mechs', () => {
      expect(CARD_FOR_SPENDABLE_RESOURCE.mechs).eq(CardName.EVA_MECHS);
      const space = spaceCard(10);
      player.cardsInHand.push(space);
      expect(player.paymentOptionsForCard(space).mechs).is.true;
      expect(player.getSpendable('mechs')).eq(2);
      expect(new SelectProjectCardToPlay(player, [space]).toModel(player).mechs).eq(2);
      expect(player.canSpend(Payment.of({mechs: 3})), 'a third mech would be one of Mech Sports\'').is.false;
    });

    it('paying with mechs takes them from EVA Mechs and leaves the three here', () => {
      const space = spaceCard(10);
      player.cardsInHand.push(space);
      player.checkPaymentAndPlayCard(space, Payment.of({mechs: 2}));
      runAllActions(game);
      expect(eva.resourceCount).eq(0);
      expect(card.resourceCount).eq(3);
      expect(card.getVictoryPoints(player)).eq(3);
    });

    it('alone in the tableau the card makes no mech spendable at all', () => {
      player.playedCards.remove(eva);
      expect(player.getSpendable('mechs')).eq(0);
      expect(player.canAfford({cost: 5, mechs: true})).is.false;
    });
  });

  describe('rule 5 — a mech is a full card resource: «mech to any card» lands here, and scores', () => {
    it('the card is a mech holder for every generic «add to any card»', () => {
      expect(player.getResourceCards(CardResource.MECH).map(toName)).to.include(CardName.MECH_SPORTS);
      expect(new AddResourcesToCard(player, CardResource.MECH, {count: 1}).getCards().map(toName)).to.include(CardName.MECH_SPORTS);
    });

    it('a Vesta trade that picks this card puts the mechs here, and the VP grow with them', () => {
      const vesta = new Vesta();
      game.phase = Phase.ACTION;
      game.colonies = [vesta];
      const eva = new EvaMechs();
      player.playedCards.push(eva);
      vesta.trackPosition = 6; // the 7th cell: 3 units
      vesta.trade(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map(toName)).to.have.members([CardName.EVA_MECHS, CardName.MECH_SPORTS]);
      pick.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
      expect(eva.resourceCount).eq(0);
      expect(card.getVictoryPoints(player)).eq(3);
    });
  });

  describe('rule 6 — Automated Convoys spends ITS OWN mech; the mechs here never open its trade', () => {
    it('with an empty Convoys card and 3 mechs here the trade variant is off, named for its own card', () => {
      game.colonies = [new Luna(), new Triton()];
      const convoys = new AutomatedConvoys();
      player.playedCards.push(convoys);
      card.resourceCount = 3;
      player.energy = 0;
      const trade = convoys.actionPreview(player).branches[1];
      expect(trade.available).is.false;
      expect(trade.unavailableReason).eq('No mechs on this card');
      expect(new TradeWithAutomatedConvoys(player).canUse()).is.false;
      expect(convoys.canAct(player)).is.false;
    });
  });

  describe('save / reload', () => {
    it('the stored mechs survive serialization and still score', () => {
      card.resourceCount = 2;
      const serialized = player.serialize();
      expect(serialized.playedCards.find((c) => c.name === CardName.MECH_SPORTS)?.resourceCount).eq(2);
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id);
      const reloadedCard = again.playedCards.get(CardName.MECH_SPORTS) as IProjectCard | undefined;
      expect(reloadedCard?.resourceCount).eq(2);
      expect(reloadedCard?.getVictoryPoints(again)).eq(2);
    });
  });
});
