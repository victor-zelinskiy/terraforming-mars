import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {GhgShipment} from '../../../src/server/cards/prelude2/GhgShipment';
import {JovianLanterns} from '../../../src/server/cards/colonies/JovianLanterns';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {setRulingParty} from '../../TestingUtils';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {cast} from '../../../src/common/utils/utils';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {Dirigibles} from '@/server/cards/venusNext/Dirigibles';
import {FloatingHabs} from '@/server/cards/venusNext/FloatingHabs';
import {Manutech} from '@/server/cards/venusNext/Manutech';
import {StormCraftIncorporated} from '@/server/cards/colonies/StormCraftIncorporated';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {BackroomDeal} from '@/server/cards/turmoilRedux/BackroomDeal';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {Parliament} from '@/server/parliament/Parliament';
import {Payment} from '@/common/inputs/Payment';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {effectForecastForPlay} from '@/server/models/effectForecast';
import {countedPlayEffects} from '@/server/models/actionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '@/server/models/unplayableReasons';
import {requiredPartyOf} from '@/server/cards/requirements/partyRequirementCards';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('GhgShipment', () => {
  it('canPlay', () => {
    const card = new GhgShipment();
    const [game, player] = testGame(1, {turmoilExtension: true});

    expect(card.canPlay(player)).is.false;

    setRulingParty(game, PartyName.KELVINISTS);

    expect(card.canPlay(player)).is.true;
  });

  it('play', () => {
    const card = new GhgShipment();
    const [/* game */, player] = testGame(1, {turmoilExtension: true});

    const jovianLanterns = new JovianLanterns();
    const searchForLife = new SearchForLife();

    player.playedCards.push(jovianLanterns, searchForLife);

    searchForLife.resourceCount = 2;
    jovianLanterns.resourceCount = 5;

    cast(card.play(player), undefined);

    expect(player.production.heat).eq(1);
    expect(player.stock.heat).eq(5);
  });
});

/**
 * P75 — GHG SHIPMENT IN THE PREMIUM SCOPE: the SEVENTH Prelude 2 card adapted IN PLACE, the third POLITICAL one and the
 * FIRST in scope whose printed party is the classic KELVINISTS (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5).
 * Rulebook p.13: «Kelvinists and Greens are one and the same» — the facade (`game.politics`) reads the printed party
 * through the ONE translation point (`normalizeReduxParty`), so on a Redux table the requirement, its standing and the
 * hand's reason are the GREENS'. The rules did not change: +1 heat production, then 1 heat for each of the player's
 * floaters (every card of theirs, the corporation included — `getResourceCount`).
 */
describe('GhgShipment — on a Turmoil Redux table', () => {
  const G = PartyName.GREENS;
  const MANUTECH = CardName.MANUTECH;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: GhgShipment};

  /** A two-seat Redux + Prelude 2 + Venus table (Colonies on, as the set is played) in the action phase, the card in hand. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true, venusNextExtension: true});
    game.phase = Phase.ACTION;
    const card = new GhgShipment();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /**
   * Three QUIET real resolutions up for the vote — the Greens' in slot 0 — and UNITY in power. ⚠ A fresh Redux table
   * opens with the GREENS ruling (no card enacted yet), so a table where the card is LOCKED seats another party's law.
   */
  function parliamentTable(): Table {
    const t = table();
    ([G, PartyName.MARS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    seatEnacted(t.parliament, quietResolutionOf(PartyName.UNITY));
    expect(t.parliament.rulingParty()).eq(PartyName.UNITY);
    return t;
  }

  /** The Greens rule: their quiet resolution stands enacted. */
  function greensRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(G));
    expect(t.parliament.rulingParty()).eq(G);
    return t;
  }

  /** The second road: two of p1's delegates on the Greens' resolution (slot 0). */
  function twoDelegates(t: Table): Table {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
    return t;
  }

  /** Dirigibles with 3 floaters and Floating Habs with 2 on `who`'s table — 5 floaters. */
  function floaters(t: Table, who: TestPlayer = t.p1): void {
    const dirigibles = new Dirigibles();
    const habs = new FloatingHabs();
    dirigibles.resourceCount = 3;
    habs.resourceCount = 2;
    who.playedCards.push(dirigibles, habs);
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const gainOf = (effects: ReadonlyArray<ActionEffect>, icon: string, note?: string) =>
    effects.find((e) => e.direction === 'gain' && e.icon === icon && e.note === note);

  it('rule 1 — the printed card: an event, 3, Space, no VP, the Kelvinists\' plate (read as the Greens), P75; political, marked for Redux', () => {
    const c = new GhgShipment();
    expect(c.name).eq(CardName.GHG_SHIPMENT);
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(3);
    expect(c.tags).deep.eq([Tag.SPACE]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c), 'the print stays upstream\'s — the classic facade reads it as it is').eq(PartyName.KELVINISTS);
    expect(c.metadata.cardNumber).eq('P75');
    expect(c.metadata.description, 'the text names the TABLE\'S party').include('Requires that Greens are ruling');
    expect(c.metadata.description).not.include('Kelvinists');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.GHG_SHIPMENT];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  describe('rule 2 — the requirement: the GREENS rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason — the Greens (never «Kelvinists»), «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on the Greens\' resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, current: 1});
    });

    it('the Greens\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`)', () => {
      const t = table();
      ([PartyName.MARS, PartyName.SCIENTISTS, PartyName.UNITY] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      seatEnacted(t.parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, partyOffVote: true});
    });

    it('two delegates on the Greens\' resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Greens rule: playable', () => {
      const t = greensRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Greens EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, G, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, G)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('a party waiver armed (TR70 Backroom Deal) lifts the requirement', () => {
      const t = parliamentTable();
      t.p1.megaCredits = 2;
      const deal = new BackroomDeal();
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(t.p1.lastCardPlayed).eq(CardName.BACKROOM_DEAL);
      t.p1.megaCredits = 20;
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('paid with M€ and titanium (a Space tag) — no steel; one titanium pays the whole price', () => {
      const t = greensRuling();
      const options = t.p1.paymentOptionsForCard(t.card);
      expect(options.titanium).is.true;
      expect(options.steel).is.false;
      t.p1.titanium = 1;
      t.p1.megaCredits = 0;
      expect(t.p1.canPlay(t.card), '1 titanium = 3 M€ = the price').is.true;
    });
  });

  describe('rule 3 — +1 heat production, then 1 heat for each of YOUR floaters', () => {
    it('Dirigibles 3 + Floating Habs 2 → +5 heat, heat production +1, the card among the played events', () => {
      const t = greensRuling();
      floaters(t);
      const heat = t.p1.heat;
      play(t);
      expect(t.p1.production.heat).eq(1);
      expect(t.p1.heat - heat).eq(5);
      expect(t.p1.playedCards.some((c) => c.name === CardName.GHG_SHIPMENT)).is.true;
    });

    it('the corporation\'s floaters count (Stormcraft); an opponent\'s floaters and a microbe card do not', () => {
      const t = greensRuling();
      const storm = new StormCraftIncorporated();
      t.p1.playCorporationCard(storm);
      storm.resourceCount = 2;
      const tardigrades = new Tardigrades();
      tardigrades.resourceCount = 4;
      t.p1.playedCards.push(tardigrades);
      floaters(t, t.p2);
      const heat = t.p1.heat;
      play(t);
      expect(t.p1.heat - heat).eq(2);
    });

    it('no floaters: an honest ZERO — the production step still lands, no «+0» heat in the journal', () => {
      const t = greensRuling();
      const from = t.game.events.events.length;
      const heat = t.p1.heat;
      play(t);
      expect(t.p1.heat).eq(heat);
      expect(t.p1.production.heat).eq(1);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      expect(mine.some((e) => e.type === 'resource-changed' && (e.impact?.stock?.heat ?? 0) !== 0), 'no «+0»').is.false;
    });

    it('the GREENS\' effect answers the heat production step: +1 M€ production — on BOTH roads (the delegates give the effect too)', () => {
      for (const t of [greensRuling(), twoDelegates(parliamentTable())]) {
        expect(t.game.politics!.hasPartyEffect(t.p1, G)).is.true;
        play(t);
        expect(t.p1.production.heat).eq(1);
        expect(t.p1.production.megacredits, 'raising your heat production raises your M€ production as many steps').eq(1);
      }
    });

    it('Manutech answers BOTH production steps: +1 heat beside the card\'s 5, and +1 M€ for the Greens\' step', () => {
      const t = greensRuling();
      t.p1.playCorporationCard(new Manutech());
      floaters(t);
      const heat = t.p1.heat;
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.heat - heat, '5 from the card, 1 from Manutech').eq(6);
      expect(t.p1.megaCredits - mc, 'Manutech on the Greens\' M€ production step (`playCard` takes no payment)').eq(1);
    });
  });

  describe('rule 4 — the forecast before the press', () => {
    it('the play preview: «+1 heat production» and «+5 heat» counted by ONE term, the player\'s floaters; read-only', () => {
      const t = greensRuling();
      floaters(t);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(gainOf(effects, 'heat', 'production'), JSON.stringify(effects)).deep.include({amount: 1, current: 0, resulting: 1});
      const heat = gainOf(effects, 'heat');
      expect(heat?.amount, JSON.stringify(effects)).eq(5);
      expect(heat?.basis).deep.eq([{count: 5, label: 'Your floaters'}]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('«Сработает» promises every answer the play sets off: Manutech\'s heat, the Greens\' M€ production — and Manutech\'s M€ for the Greens\' step (the cascade of a party\'s answer)', () => {
      const t = greensRuling();
      t.p1.playCorporationCard(new Manutech());
      floaters(t);
      const forecast = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card));
      const facts = forecast.facts.map((f) => [f.source.name, f.effects.map((e) => `${e.icon}${e.note === 'production' ? ':production' : ''}+${e.amount}`).join(',')]);
      expect(facts).deep.eq([
        [MANUTECH, 'heat+1'],
        [G, 'megacredits:production+1'],
        [MANUTECH, 'megacredits+1'],
      ]);
      // …and the live play pays exactly that.
      const heat = t.p1.heat;
      const mc = t.p1.megaCredits;
      play(t);
      expect([t.p1.heat - heat - 5, t.p1.production.megacredits, t.p1.megaCredits - mc]).deep.eq([1, 1, 1]);
    });

    it('the hand reads the same counted number off the server (`countedPlayEffects`)', () => {
      const t = greensRuling();
      floaters(t);
      const heat = gainOf(countedPlayEffects(t.p1, t.card), 'heat');
      expect(heat?.amount).eq(5);
      expect(heat?.basis).deep.eq([{count: 5, label: 'Your floaters'}]);
    });
  });

  describe('rule 5 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.GHG_SHIPMENT);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.GHG_SHIPMENT);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.GHG_SHIPMENT)).is.false;
    });

    it('save / reload: the production and the heat kept, the card among the played', () => {
      const t = greensRuling();
      floaters(t);
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.production.heat).eq(1);
      expect(owner.heat).eq(t.p1.heat);
      expect(owner.playedCards.some((c) => c.name === CardName.GHG_SHIPMENT)).is.true;
    });

    it('MarsBot at the table (the card brought in by hand): the count is the HUMAN\'s floaters — the bot\'s are not', () => {
      const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([G, PartyName.MARS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(G));
      game.automa!.floaters = 4;
      const c = new GhgShipment();
      human.cardsInHand.push(c);
      const dirigibles = new Dirigibles();
      dirigibles.resourceCount = 1;
      human.playedCards.push(dirigibles);
      human.megaCredits = 20;
      expect(human.canPlay(c)).is.true;
      const heat = human.heat;
      human.playCard(c);
      runAllActions(game);
      expect(human.heat - heat, 'its one floater — never the bot\'s four').eq(1);
    });
  });
});
