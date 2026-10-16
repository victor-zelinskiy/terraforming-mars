import {expect} from 'chai';
import {ENERGY_PRODUCTION, SponsoredPowerPlant} from '../../../src/server/cards/turmoilRedux/SponsoredPowerPlant';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {Thorgate} from '../../../src/server/cards/corporation/Thorgate';
import {Manutech} from '../../../src/server/cards/venusNext/Manutech';
import {PowerSupplyConsortium} from '../../../src/server/cards/base/PowerSupplyConsortium';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Resource} from '../../../src/common/Resource';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR59 — SPONSORED POWER PLANT: the Industrialists' seventh plate over a whole
 * declaration — +3 energy production, Power + Building tags, no VP. Every rule
 * reading of the card file's header is pinned here: the plate's two roads,
 * the production step (never the stock), the two tags' answers (Thorgate,
 * steel, Construction Mechs), the table's answer to the step (Manutech),
 * preview = execution, purity, save / load.
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 8;
const SPP = CardName.SPONSORED_POWER_PLANT;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: SponsoredPowerPlant};

/** A two-seat Redux table in the action phase, the Industrialists RULING, the card in hand and 20 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  const card = new SponsoredPowerPlant();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

/** The play with M€ only (what the card costs this player), every deferred step run. */
function play(t: Table, payment: Payment = Payment.of({megacredits: t.player.getCardCost(t.card)})): void {
  t.player.playCard(t.card, payment);
  runAllActions(t.game);
}

describe('SponsoredPowerPlant', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green card for 8, Power + Building, the INDUSTRIALISTS\' plate, no VP, TR59 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(SPP);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner: the lightning, then the roof').deep.eq([Tag.POWER, Tag.BUILDING]);
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(card.resourceType, 'no card resource').is.undefined;
      expect(card.behavior).deep.eq({production: {energy: 3}});
      expect(ENERGY_PRODUCTION).eq(3);
      expect(card.metadata.cardNumber).eq('TR59');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there. Increase your energy production 3 steps.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[SPP];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    });

    it('the face reads the scan: ONE row — the production plate with THREE energy icons, never «3 [energy]»', () => {
      type Node = {is?: string, type?: string, amount?: number, showDigit?: boolean, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const boxes = rows[0].filter((n): n is Node => typeof n === 'object');
      expect(boxes).has.length(1);
      expect(boxes[0].is).eq('production-box');
      const items = (boxes[0].rows?.[0] ?? []).filter((n): n is Node => typeof n === 'object');
      expect(items.map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.ENERGY, 3]]);
      // No digit: an amount ≤ 5 without `{digit}` draws as that many icons (`mechanicsModel.itemRepeats`, Fusion Power's print).
      expect(items[0].showDigit, 'three icons, never «3 [energy]»').is.undefined;
    });

    it('the structured text is the requirement block + the production step', () => {
      const info = buildCardInformation(new SponsoredPowerPlant(), 'turmoilRedux');
      const texts = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(texts[0]).eq('Requires Industrialists to be ruling or that you have 2 delegates on its resolution.');
      expect(texts).to.include('Increase your energy production 3 steps.');
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
      // «Their resolution is not on the vote» is the ARRANGEMENT, never the deal (TR55's lesson: the seeded deal moves
      // whenever the catalog grows). A slot of theirs is replaced by a quiet card of a party the table does not hold.
      const at = t.parliament.slots.findIndex((slot) => t.parliament.resolutionOf(slot.instance).party === I);
      if (at >= 0) {
        const onTable = t.parliament.slots.map((slot) => t.parliament.resolutionOf(slot.instance).party);
        const free = ([PartyName.MARS, PartyName.UNITY, PartyName.GREENS] as const).find((p) => !(onTable as ReadonlyArray<PartyName>).includes(p));
        seatResolution(t.parliament, at, quietResolutionOf(free!));
      }
      expect(t.parliament.slotOf(I), 'the Industrialists off the vote').is.undefined;
    });

    function industrialistsCubes(player: TestPlayer, n: number): void {
      let slot = t.parliament.slotOf(I);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(I));
        slot = t.parliament.slotOf(I)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
      }
    }

    it('neither road: the NAMED party reason; one own delegate: «1 of 2», unplayable; two: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [I, '2'], party: I, current: 0,
        partyOffVote: true, requirement: true, requirementKey: 'req:party',
      }]);
      industrialistsCubes(t.player, 1);
      expect(t.player.canPlay(t.card), '1 delegate and not ruling').is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1});
      industrialistsCubes(t.player, 1);
      expect(t.player.canPlay(t.card), '2 own delegates').is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the delegates must be the player\'s OWN: two of the opponent\'s open nothing', () => {
      industrialistsCubes(t.opponent, 2);
      expect(t.player.canPlay(t.card)).is.false;
    });

    it('the Industrialists ruling: playable with no delegate anywhere', () => {
      seatEnacted(t.parliament, quietResolutionOf(I));
      expect(t.parliament.rulingParty()).eq(I);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      t.player.playedCards.push(new CouncilSeat());
      industrialistsCubes(t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — the play: +3 energy PRODUCTION', () => {
    it('+3 energy production (never stock), the cost paid, the journal reads «gained 3 energy production»', () => {
      t.player.production.override({energy: 1});
      t.player.energy = 2;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.player.production.energy).eq(4);
      expect(t.player.energy, 'production, never stock').eq(2);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(SPP)).eq(t.card);
      expect(t.player.getWaitingFor(), 'nothing is asked').is.undefined;
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      expect(lines.some((l) => /gained 3 energy production/.test(l)), lines.join('\n')).is.true;
    });

    it('it pays out at the production phase — the engine\'s rule', () => {
      play(t);
      t.player.energy = 0;
      t.player.runProductionPhase();
      expect(t.player.energy).eq(3);
    });
  });

  describe('rule 3 — the tags: Power (Thorgate, Power-tag requirements), Building (steel, Construction Mechs)', () => {
    it('Thorgate takes 3 M€ off: the card costs 5', () => {
      t.player.playedCards.push(new Thorgate());
      expect(t.player.getCardCost(t.card)).eq(COST - 3);
      t.player.megaCredits = COST - 3;
      expect(t.player.canPlay(t.card)).is.true;
      play(t);
      expect(t.player.megaCredits).eq(0);
      expect(t.player.production.energy).eq(3);
    });

    it('another card\'s Power-tag requirement counts it (Power Supply Consortium: 2 power tags)', () => {
      const consortium = new PowerSupplyConsortium();
      t.player.playedCards.push(fakeCard({name: 'power 1' as CardName, tags: [Tag.POWER]}));
      t.player.megaCredits = 60;
      expect(t.player.canPlay(consortium)).is.false;
      play(t);
      expect(t.player.canPlay(consortium)).is.true;
    });

    it('steel pays for it (the Building tag)', () => {
      expect(t.player.paymentOptionsForCard(t.card).steel).is.true;
      t.player.megaCredits = 0;
      t.player.steel = 4;
      expect(t.player.canPlay(t.card)).is.true;
      play(t, Payment.of({steel: 4}));
      expect(t.player.steel).eq(0);
      expect(t.player.playedCards.get(SPP)).eq(t.card);
    });

    it('Construction Mechs PAYS for it with mechs (the Building tag), EVA does not', () => {
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.constructionMechs).is.true;
      expect(options.mechs).is.false;
      const construction = new ConstructionMechs();
      construction.resourceCount = 2;
      t.player.playedCards.push(construction);
      t.player.megaCredits = 0;
      play(t, Payment.of({constructionMechs: 2}));
      expect(t.player.playedCards.get(SPP)).eq(t.card);
      expect(construction.resourceCount).eq(0);
      expect(t.player.production.energy).eq(3);
    });
  });

  describe('rule 4 — the table\'s answer to the step: Manutech', () => {
    it('the forecast names Manutech: +3 energy (exact); the press answers as forecast', () => {
      t.player.playedCards.push(new Manutech());
      const forecast = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card));
      const manutech = forecast.facts.find((f) => f.source.name === CardName.MANUTECH);
      expect(manutech?.certainty, JSON.stringify(forecast)).eq('exact');
      expect(manutech?.effects[0]).deep.include({icon: Resource.ENERGY, amount: 3});
      t.player.energy = 0;
      play(t);
      expect([t.player.production.energy, t.player.energy]).deep.eq([3, 3]);
    });
  });

  describe('rule 5 — preview = execution', () => {
    it('declarative: «+3 [energy] production current → resulting»', () => {
      t.player.production.override({energy: 2});
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      const chip = preview.branches[0].effects.find((e) => e.icon === Resource.ENERGY);
      expect(chip).deep.include({direction: 'gain', amount: 3, current: 2, resulting: 5, note: 'production'});
      play(t);
      expect(t.player.production.energy, 'the press lands where the preview said').eq(5);
    });

    it('the previews are pure: building them moves nothing', () => {
      t.player.playedCards.push(new Manutech());
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.player, t.card);
      effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card));
      unplayableReasons(t.player, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('rule 7 — save / load', () => {
    it('an ordinary card: the reloaded tableau holds it and the production', () => {
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.player.id);
      expect(owner.playedCards.get(SPP)?.name).eq(SPP);
      expect(owner.production.energy).eq(3);
    });
  });
});
