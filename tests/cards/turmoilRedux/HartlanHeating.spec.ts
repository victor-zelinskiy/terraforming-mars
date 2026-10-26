import {expect} from 'chai';
import {HARTLAN_ACTION_CARDS, HARTLAN_ACTION_HEAT, HARTLAN_HEAT_PER_TILE_CARD, HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD, HARTLAN_REASON, HartlanHeating} from '../../../src/server/cards/turmoilRedux/HartlanHeating';
import {NuclearZone} from '../../../src/server/cards/base/NuclearZone';
import {NoctisCity} from '../../../src/server/cards/base/NoctisCity';
import {LakeMarineris} from '../../../src/server/cards/base/LakeMarineris';
import {Research} from '../../../src/server/cards/base/Research';
import {ImmigrantCity} from '../../../src/server/cards/base/ImmigrantCity';
import {RestrictedArea} from '../../../src/server/cards/base/RestrictedArea';
import {Flooding} from '../../../src/server/cards/base/Flooding';
import {SubterraneanReservoir} from '../../../src/server/cards/base/SubterraneanReservoir';
import {EarlySettlement} from '../../../src/server/cards/prelude/EarlySettlement';
import {ReSettlement} from '../../../src/server/cards/turmoilRedux/ReSettlement';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {TileType} from '../../../src/common/TileType';
import {Priority} from '../../../src/server/deferredActions/Priority';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlacesTile} from '../../../src/server/cards/cardPlacesTile';
import {addOcean, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {MAX_OCEAN_TILES} from '../../../src/common/constants';

/**
 * TR80 — HARTLAN HEATING: 48 M€ + 2 heat production; «after you play a green project card that places a tile, gain 6
 * heat and increase your M€ production 1 step» (the printed class `cardPlacesTile` ∧ AUTOMATED — the one predicate
 * the live hook, the forecast twin and the worklist guard read); «pay 12 heat to draw 2 cards». Every rule reading of
 * the card file's header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: HartlanHeating};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new HartlanHeating();
  player.playedCards.push(card);
  player.megaCredits = 100;
  rival.megaCredits = 100;
  player.production.override({energy: 2});
  return {game, player, rival, card};
}

/** The pending placement prompt of `player`, answered on its first legal cell. */
function placeFirst(t: Table, player: TestPlayer = t.player): void {
  const prompt = cast(player.getWaitingFor(), SelectSpace);
  prompt.cb(prompt.spaces[0]);
  runAllActions(t.game);
}

describe('HartlanHeating', () => {
  describe('rule 0 — the card as printed', () => {
    it('a corporation for 48 M€, Space + Building, no VP, no first action — TR80, the third new corporation', () => {
      const card = new HartlanHeating();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(48);
      expect(card.tags).deep.eq([Tag.SPACE, Tag.BUILDING]);
      expect(card.victoryPoints).is.undefined;
      expect(card.initialActionText).is.undefined;
      expect(card.metadata.cardNumber).eq('TR80');
      expect(card.metadata.reimplements).is.undefined;
      expect(newCorporationCardNumber(CardName.HARTLAN_HEATING)).eq('TR80');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS[2]).deep.include({name: 'Hartlan Heating', authored: CardName.HARTLAN_HEATING});
      expect(Object.keys(TURMOIL_REDUX_CARD_MANIFEST.corporationCards)).to.include(CardName.HARTLAN_HEATING);
    });

    it('the play: 2 heat production, 48 M€', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      player.playCorporationCard(new HartlanHeating());
      expect(player.production.heat).eq(2);
      expect(player.megaCredits).eq(48);
    });
  });

  describe('rule 1 — the printed class: a GREEN card that places a tile', () => {
    it('a declarative tile, a bespoke placement with its flag — yes; a green card without a tile — no', () => {
      expect(HartlanHeating.answersTo(new NuclearZone()), 'Nuclear Zone: behavior.tile').is.true;
      expect(HartlanHeating.answersTo(new LakeMarineris()), 'Lake Marineris: behavior.ocean').is.true;
      expect(HartlanHeating.answersTo(new NoctisCity()), 'Noctis City: a bespoke city with placesTile').is.true;
      expect(cardPlacesTile(new NoctisCity())).is.true;
      expect(HartlanHeating.answersTo(new Research()), 'Research: no tile').is.false;
    });

    it('a blue card, an event or a prelude with a tile — no (the colour is Hartlan\'s own reading, the class is not)', () => {
      expect(cardPlacesTile(new RestrictedArea()), 'the class knows no colour (a blue declarative tile)').is.true;
      expect(cardPlacesTile(new ImmigrantCity()), 'the class knows no colour (a blue bespoke city)').is.true;
      expect(HartlanHeating.answersTo(new RestrictedArea()), 'blue').is.false;
      expect(HartlanHeating.answersTo(new ImmigrantCity()), 'blue').is.false;
      expect(HartlanHeating.answersTo(new Flooding()), 'event').is.false;
      expect(HartlanHeating.answersTo(new SubterraneanReservoir()), 'event').is.false;
      expect(HartlanHeating.answersTo(new EarlySettlement()), 'prelude').is.false;
    });

    it('a card that only MOVES a tile is not of the class', () => {
      expect(cardPlacesTile(new ReSettlement())).is.false;
      expect(HartlanHeating.answersTo(new ReSettlement())).is.false;
    });
  });

  describe('rule 2 — the effect: 6 heat + 1 M€ production AFTER the play', () => {
    it('a green card with a tile: nothing before the cell is chosen, both gains once the tile landed, under the corporation\'s own effect scope', () => {
      const t = table();
      const heat = t.player.heat;
      const production = t.player.production.megacredits;
      const before = t.game.events.events.length;
      t.player.playCard(new NuclearZone());
      runAllActions(t.game);
      expect(t.player.heat, 'deferred behind the play\'s own prompt').eq(heat);
      expect(t.player.production.megacredits).eq(production);
      placeFirst(t);
      expect(t.player.heat).eq(heat + HARTLAN_HEAT_PER_TILE_CARD);
      expect(t.player.production.megacredits).eq(production + HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD);
      const markers = t.game.events.events.slice(before).filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'corporation' && e.source.card === CardName.HARTLAN_HEATING);
      expect(markers.map((e) => e.trigger), 'one marker, on the card-played channel').deep.eq(['card-played']);
    });

    it('a bespoke placement with no prompt (Noctis City on the reserved area) pays the same', () => {
      const t = table();
      const heat = t.player.heat;
      t.player.playCard(new NoctisCity());
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect(t.player.heat).eq(heat + HARTLAN_HEAT_PER_TILE_CARD);
      expect(t.player.production.megacredits).eq(HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD + 3);
    });

    it('two tiles on one card (Lake Marineris) pay ONCE — per card, never per tile', () => {
      const t = table();
      const heat = t.player.heat;
      t.player.playCard(new LakeMarineris());
      runAllActions(t.game);
      placeFirst(t);
      placeFirst(t);
      expect(t.game.board.getOceanSpaces()).to.have.lengthOf(2);
      expect(t.player.heat).eq(heat + HARTLAN_HEAT_PER_TILE_CARD);
      expect(t.player.production.megacredits).eq(HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD);
    });

    it('an ocean card played at the ocean ceiling still pays — the class is printed, not «a tile really landed»', () => {
      const t = table();
      for (let i = 0; i < MAX_OCEAN_TILES; i++) {
        addOcean(t.player);
      }
      expect(t.game.board.getOceanSpaces()).to.have.lengthOf(MAX_OCEAN_TILES);
      const heat = t.player.heat;
      t.player.playCard(new LakeMarineris());
      runAllActions(t.game);
      expect(t.player.getWaitingFor(), 'no cell to choose at the ceiling').is.undefined;
      expect(t.player.heat).eq(heat + HARTLAN_HEAT_PER_TILE_CARD);
    });

    it('a green card without a tile, a blue card with one, a rival\'s green tile card — nothing', () => {
      const t = table();
      const heat = t.player.heat;
      t.player.playCard(new Research());
      runAllActions(t.game);
      expect(t.player.heat).eq(heat);

      const before = t.game.events.events.length;
      t.player.playCard(new ImmigrantCity());
      runAllActions(t.game);
      placeFirst(t);
      expect(t.player.heat).eq(heat);

      t.rival.production.override({energy: 2});
      t.rival.playCard(new NuclearZone());
      runAllActions(t.game);
      placeFirst(t, t.rival);
      expect(t.player.heat).eq(heat);
      expect(t.rival.heat).eq(0);
      const markers = t.game.events.events.slice(before).filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'corporation' && e.source.card === CardName.HARTLAN_HEATING);
      expect(markers, 'Hartlan never fired').deep.eq([]);
    });

    it('a city by a standard project is no card — nothing', () => {
      const t = table();
      const heat = t.player.heat;
      const space = t.game.board.getAvailableSpacesForCity(t.player)[0];
      t.game.addCity(t.player, space);
      runAllActions(t.game);
      expect(t.player.heat).eq(heat);
      expect(t.player.production.megacredits).eq(0);
    });

    it('with Tharsis Republic on the same table a green city card wakes both (multicorp)', () => {
      const t = table();
      t.player.playedCards.push(new TharsisRepublic());
      const heat = t.player.heat;
      const cash = t.player.megaCredits;
      t.player.playCard(new NoctisCity());
      runAllActions(t.game);
      expect(t.player.heat).eq(heat + HARTLAN_HEAT_PER_TILE_CARD);
      expect(t.player.megaCredits).eq(cash + 3);
      // Noctis +3, Tharsis +1 (a city on Mars), Hartlan +1.
      expect(t.player.production.megacredits).eq(3 + 1 + HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD);
    });
  });

  describe('rule 3 — the forecast twin', () => {
    it('a green card with a tile: ONE exact fact of the corporation, block #0, after the card at the gain\'s priority, the bare deltas', () => {
      const t = table();
      const trigger = new NuclearZone();
      t.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger));
      const facts = forecast.facts.filter((f) => f.source.name === CardName.HARTLAN_HEATING);
      expect(facts).to.have.lengthOf(1);
      const fact = facts[0];
      expect(fact.certainty).eq('exact');
      expect(fact.source).deep.eq({kind: 'corporation', name: CardName.HARTLAN_HEATING, owner: t.player.color, channel: 'card-played', printedEffect: 0});
      expect(fact.recipient).deep.eq({kind: 'you'});
      expect(fact.timing).eq('after-card');
      expect(fact.sequence).eq(Priority.GAIN_RESOURCE_OR_PRODUCTION);
      expect(fact.reason).eq(HARTLAN_REASON);
      expect(fact.effects.map((e) => [e.direction, e.icon, e.amount, e.note === 'production'])).deep.eq([
        ['gain', 'heat', HARTLAN_HEAT_PER_TILE_CARD, false],
        ['gain', 'megacredits', HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD, true],
      ]);
      expect(forecast.coverage).eq('complete');
    });

    it('a green card without a tile forecasts NOTHING — not a «no» fact', () => {
      const t = table();
      const trigger = new Research();
      t.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger));
      expect(forecast.facts.filter((f) => f.source.name === CardName.HARTLAN_HEATING)).deep.eq([]);
    });

    it('a blue card with a tile forecasts nothing either', () => {
      const t = table();
      const trigger = new ImmigrantCity();
      t.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger));
      expect(forecast.facts.filter((f) => f.source.name === CardName.HARTLAN_HEATING)).deep.eq([]);
    });
  });

  describe('rule 4 — the action: 12 heat → 2 cards, one batch', () => {
    it('below 12 heat: unavailable, with the engine\'s own reason', () => {
      const t = table();
      t.player.heat = HARTLAN_ACTION_HEAT - 1;
      expect(t.card.canAct(t.player)).is.false;
      const reasons = actionUnavailableReasons(t.player, t.card);
      expect(reasons.map((r) => r.message)).to.include('Not enough heat');
    });

    it('at 12 heat: the price leaves, two cards arrive as ONE reveal batch of this card', () => {
      const t = table();
      t.player.heat = HARTLAN_ACTION_HEAT;
      const hand = t.player.cardsInHand.length;
      const reveals = t.player.cardDrawReveals.length;
      expect(t.card.canAct(t.player)).is.true;
      t.card.action(t.player);
      runAllActions(t.game);
      expect(t.player.heat).eq(0);
      expect(t.player.cardsInHand).to.have.lengthOf(hand + HARTLAN_ACTION_CARDS);
      const batch = t.player.cardDrawReveals.slice(reveals);
      expect(batch).to.have.lengthOf(1);
      expect(batch[0].cards).to.have.lengthOf(HARTLAN_ACTION_CARDS);
      expect(batch[0].source).deep.eq({type: 'card', cardName: CardName.HARTLAN_HEATING});
    });
  });

  describe('rule 5 — the reaction record (the console\'s scene)', () => {
    it('a green tile card writes ONE record: the corporation, the channel, the cause, both impacts', () => {
      const t = table();
      const trigger = new NuclearZone();
      t.player.playCard(trigger);
      runAllActions(t.game);
      expect(t.game.cardReactions.filter((r) => r.card === CardName.HARTLAN_HEATING), 'nothing landed yet').deep.eq([]);
      placeFirst(t);
      const records = t.game.cardReactions.filter((r) => r.card === CardName.HARTLAN_HEATING);
      expect(records).to.have.lengthOf(1);
      const record = records[0];
      expect(record.owner).eq(t.player.color);
      expect(record.kind).eq('corporation');
      expect(record.channel).eq('card-played');
      expect(record.cause).deep.eq({card: CardName.NUCLEAR_ZONE});
      expect(record.impacts).deep.eq([
        {kind: 'stock', resource: Resource.HEAT, amount: HARTLAN_HEAT_PER_TILE_CARD, to: t.player.color},
        {kind: 'production', resource: Resource.MEGACREDITS, amount: HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD, to: t.player.color},
      ]);
      expect(record.root.actionId).to.be.a('number');
      expect(TileType.NUCLEAR_ZONE).is.not.undefined;
    });
  });

  describe('rule 6 — the deal and the save', () => {
    it('a Redux table deals the corporation; a classic Turmoil table does not', () => {
      const [redux] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      expect(redux.corporationDeck.drawPile.map((c) => c.name)).to.include(CardName.HARTLAN_HEATING);
      const [classic] = testGame(2, {turmoilExtension: true});
      expect(classic.corporationDeck.drawPile.map((c) => c.name)).to.not.include(CardName.HARTLAN_HEATING);
    });

    it('the reaction ring is presentation only — a save holds no record, the rule survives', () => {
      const t = table();
      t.player.playCard(new NoctisCity());
      runAllActions(t.game);
      expect(t.game.cardReactions.length).to.be.greaterThan(0);
      const serialized = t.game.serialize();
      expect(JSON.stringify(serialized)).to.not.include('cardReactions');
    });
  });
});
