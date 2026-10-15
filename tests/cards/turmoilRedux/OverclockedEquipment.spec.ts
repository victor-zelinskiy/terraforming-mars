import {expect} from 'chai';
import {OVERCLOCKED_ENERGY_PRICE, OVERCLOCKED_RESOURCES, OverclockedEquipment, overclockedAmount} from '../../../src/server/cards/turmoilRedux/OverclockedEquipment';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Thorgate} from '../../../src/server/cards/corporation/Thorgate';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Resource} from '../../../src/common/Resource';
import {Payment} from '../../../src/common/inputs/Payment';
import {OrOptionsModel, SelectOptionModel} from '../../../src/common/models/PlayerInputModel';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {resolutionCount} from '../../../src/server/parliament/resolutions/ResolutionCounts';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {cast} from '../../../src/common/utils/utils';
import {formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR54 — OVERCLOCKED EQUIPMENT: the Industrialists' plate, «also pay 3 energy»
 * (a declared `spend`), and ONE question — which standard resource, as many as
 * the production of it. Every rule reading of the card file's header is pinned
 * here; the palette that asks the question is the client's
 * (docs/TURMOIL_REDUX_OVERCLOCKED_EQUIPMENT.md).
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 9;
const OE = CardName.OVERCLOCKED_EQUIPMENT;

type Table = {game: IGame, player: TestPlayer, parliament: Parliament, card: OverclockedEquipment};

/**
 * A two-seat Redux table in the action phase, the Industrialists RULING, the
 * card in hand, 20 M€, 5 energy, and six different productions: M€ −1 (a named
 * zero), steel 2, titanium 0, plants 3, energy 1, heat 4.
 */
function table(): Table {
  const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  const card = new OverclockedEquipment();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  player.energy = 5;
  player.production.override({megacredits: -1, steel: 2, titanium: 0, plants: 3, energy: 1, heat: 4});
  return {game, player, parliament, card};
}

/** The play as the player's own action — the price paid, the question standing. */
function play(t: Table): OrOptions {
  const events = t.game.events;
  events.beginAction(t.player, {kind: 'card', card: OE, owner: t.player.color}, {category: 'card-play'});
  try {
    t.player.playCard(t.card, Payment.of({megacredits: t.player.getCardCost(t.card)}));
  } finally {
    events.endScope();
  }
  runAllActions(t.game);
  return cast(t.player.popWaitingFor(), OrOptions);
}

function answer(t: Table, or: OrOptions, resource: Resource): void {
  const index = OVERCLOCKED_RESOURCES.indexOf(resource);
  or.process({type: 'or', index, response: {type: 'option'}}, t.player);
  runAllActions(t.game);
}

describe('OverclockedEquipment', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green card for 9, Power, the INDUSTRIALISTS\' plate, «also pay 3 energy», TR54 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(OE);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one lightning').deep.eq([Tag.POWER]);
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(card.behavior).deep.eq({spend: {energy: 3}});
      expect(OVERCLOCKED_ENERGY_PRICE).eq(3);
      expect(card.metadata.cardNumber).eq('TR54');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there. Also pay 3 energy. ' +
        'Pick a basic resource type. Gain an amount of that resource equal to your production of it.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[OE];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    });

    it('the face reads the scan: ONE row — «−3 [energy]», the «?»*, a slash, the «?» in a production frame*', () => {
      type Node = {type?: string, amount?: number, showDigit?: boolean, is?: string, rows?: Array<Array<Node>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object');
      const kinds = items.map((n) => n.is === 'production-box' ? 'production' : n.type);
      expect(kinds).deep.eq(['-', 'energy', 'nbsp', 'wild', '*', '/', 'production', '*']);
      expect(items[1]).deep.include({type: 'energy', amount: 3, showDigit: true});
      expect(items[3]).deep.include({type: 'wild', amount: 1});
      const box = items[6].rows!.flat().filter((n) => typeof n === 'object');
      expect(box.map((n) => n.type)).deep.eq(['wild']);
    });

    it('the structured text is the requirement block + the price and the choice', () => {
      const info = buildCardInformation(new OverclockedEquipment(), 'turmoilRedux');
      const texts = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(texts[0]).eq('Requires Industrialists to be ruling or that you have 2 delegates on its resolution.');
      expect(texts).to.include('Pay 3 energy. Gain a standard resource of your choice — as many as your production of it.');
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
    });

    function industrialistsCubes(n: number): void {
      let slot = t.parliament.slotOf(I);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(I));
        slot = t.parliament.slotOf(I)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
      }
    }

    it('neither road: unplayable, the party named; two delegates: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card).map((r) => r.type)).deep.eq(['party']);
      industrialistsCubes(2);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      t.player.playedCards.push(new CouncilSeat());
      industrialistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — the price: 9 M€ + 3 energy, and the hand names ONE blocker', () => {
    it('2 energy: unplayable — «Not enough energy», the icon and the current 2, nothing else', () => {
      t.player.energy = 2;
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)).deep.eq([
        {type: 'resource', message: 'Not enough energy', resource: Resource.ENERGY, current: 2},
      ]);
      t.player.energy = 3;
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('the order of the ladder: the party first, then the energy; the energy alone without the party', () => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      t.player.energy = 2;
      expect(unplayableReasons(t.player, t.card).map((r) => [r.type, r.resource])).deep.eq([['party', undefined], ['resource', Resource.ENERGY]]);
      t.player.energy = 5;
      expect(unplayableReasons(t.player, t.card).map((r) => r.type)).deep.eq(['party']);
    });

    it('the energy leaves the stock with the play — before the question stands', () => {
      play(t);
      expect(t.player.energy).eq(2);
      expect(t.player.megaCredits).eq(20 - COST);
    });
  });

  describe('rules 3–5 — the question: six options, always, each «as many as your production»', () => {
    it('six options in the rail\'s order, five zeros included — never an auto-pick; the card\'s reward', () => {
      t.player.production.override({megacredits: 0, steel: 0, titanium: 0, plants: 3, energy: 0, heat: 0});
      const or = play(t);
      expect(or.options).has.length(6);
      expect(OVERCLOCKED_RESOURCES).deep.eq([Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT]);
      const model = or.toModel(t.player) as OrOptionsModel;
      expect(or.choiceContext).deep.eq({source: {kind: 'card', card: OE}, trigger: undefined, mode: 'reward'});
      expect(model.options.map((o) => (o as SelectOptionModel).metadata?.icon)).deep.eq(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
    });

    it('rule 4 — the amounts: M€ −1 → 0 (named), steel 2, titanium 0 (named), plants 3, energy 1, heat 4', () => {
      const or = play(t);
      const model = or.toModel(t.player) as OrOptionsModel;
      const options = model.options as Array<SelectOptionModel>;
      expect(options.map((o) => o.metadata?.amount)).deep.eq([0, 2, 0, 3, 1, 4]);
      expect(options[0].metadata?.futile).deep.eq({kind: 'zero-yield', reason: 'Production ${0} → gain 0', reasonParams: ['-1']});
      expect(options[2].metadata?.futile).deep.eq({kind: 'zero-yield', reason: 'Production 0'});
      expect(options.filter((o) => o.metadata?.futile !== undefined)).has.length(2);
      expect(OVERCLOCKED_RESOURCES.map((r) => overclockedAmount(t.player, r))).deep.eq([0, 2, 0, 3, 1, 4]);
    });

    it('choosing plants: +3 plants, nothing else moves', () => {
      const or = play(t);
      answer(t, or, Resource.PLANTS);
      expect(t.player.plants).eq(3);
      expect(t.player.steel).eq(0);
      expect(t.player.energy).eq(2);
      expect(t.player.popWaitingFor()).is.undefined;
    });

    it('rule 5 — choosing ENERGY: the price paid first, the production after — 5 → 2 → 3; the chip reads 2 → 3', () => {
      const or = play(t);
      const option = (or.toModel(t.player) as OrOptionsModel).options[4] as SelectOptionModel;
      expect(option.metadata?.effects?.[0]).deep.include({icon: 'energy', amount: 1, current: 2, resulting: 3});
      answer(t, or, Resource.ENERGY);
      expect(t.player.energy).eq(3);
    });

    it('a ZERO is a real answer: titanium stays 0, the journal says «gained 0», no skipped effect', () => {
      const or = play(t);
      const skipsBefore = t.game.events.events.filter((e) => e.type === 'effect-skipped').length;
      const at = t.game.gameLog.length;
      answer(t, or, Resource.TITANIUM);
      expect(t.player.titanium).eq(0);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      expect(lines.some((l) => /gained 0 titanium/.test(l)), lines.join('\n')).is.true;
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).has.length(skipsBefore);
    });
  });

  describe('rule 6 — preview = execution', () => {
    it('six branches in the options\' order, the price FIRST in each, the gain the option\'s own chip with its basis', () => {
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('bespoke');
      expect(preview.branches).has.length(6);
      expect(preview.branches.map((b) => b.index)).deep.eq([0, 1, 2, 3, 4, 5]);
      for (const branch of preview.branches) {
        expect(branch.effects[0]).deep.eq({direction: 'cost', icon: Resource.ENERGY, amount: 3, current: 5, resulting: 2});
      }
      const gains = preview.branches.map((b) => b.effects[1]);
      expect(gains.map((e) => [e.icon, e.amount, e.current, e.resulting])).deep.eq([
        ['megacredits', 0, 20, 20], ['steel', 2, 0, 2], ['titanium', 0, 0, 0], ['plants', 3, 0, 3], ['energy', 1, 2, 3], ['heat', 4, 0, 4],
      ]);
      expect(gains.map((e) => e.basis?.[0])).deep.eq([
        {count: -1, label: 'Your production'}, {count: 2, label: 'Your production'}, {count: 0, label: 'Your production'},
        {count: 3, label: 'Your production'}, {count: 1, label: 'Your production'}, {count: 4, label: 'Your production'},
      ]);
      // The live question's chips, after the price is paid, are the preview's own (the basis aside).
      const live = (play(t).toModel(t.player) as OrOptionsModel).options as Array<SelectOptionModel>;
      const withoutBasis = gains.map(({basis: _basis, ...rest}) => rest);
      expect(live.map((o) => o.metadata?.effects?.[0])).deep.eq(withoutBasis.map((e) => e.icon === 'megacredits' ? {...e, current: 20 - COST, resulting: 20 - COST} : e));
    });

    it('a zero branch is the server\'s «no effect» verdict — titanium and the negative M€; the others carry none', () => {
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => b.futile?.reason)).deep.eq(['Production ${0} → gain 0', undefined, 'Production 0', undefined, undefined, undefined]);
    });

    it('rule 12 — the preview mutates nothing', () => {
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.player, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('rules 8–9 — the Power tag and the journal', () => {
    it('Thorgate takes 3 M€ off; RX04 Central Power Grid counts the tag (`raw`)', () => {
      t.player.playedCards.push(new Thorgate());
      expect(t.player.getCardCost(t.card)).eq(COST - 3);
      const before = resolutionCount(t.player, 'powerTags').count;
      answer(t, play(t), Resource.HEAT);
      expect(resolutionCount(t.player, 'powerTags').count).eq(before + 1);
    });

    it('the journal: the price before the choice, then the gain', () => {
      const at = t.game.gameLog.length;
      answer(t, play(t), Resource.HEAT);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const paid = lines.findIndex((l) => /paid 3 energy for Overclocked Equipment/.test(l));
      const gained = lines.findIndex((l) => /gained 4 heat/.test(l));
      expect(paid, lines.join('\n')).greaterThan(-1);
      expect(gained).greaterThan(paid);
    });
  });

  describe('rule 10 — save / load', () => {
    it('an ordinary card: the reloaded tableau holds it, the stock as answered', () => {
      answer(t, play(t), Resource.STEEL);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.player.id);
      expect(owner.playedCards.get(OE)?.name).eq(OE);
      expect(owner.steel).eq(2);
      expect(owner.energy).eq(2);
    });
  });

  it('the option\'s own words name the amount', () => {
    const or = play(t);
    expect(or.options.map((o) => formatMessage((o as SelectOption).title))).deep.eq([
      'Gain 0 M€', 'Gain 2 steel', 'Gain 0 titanium', 'Gain 3 plants', 'Gain 1 energy', 'Gain 4 heat',
    ]);
  });
});
