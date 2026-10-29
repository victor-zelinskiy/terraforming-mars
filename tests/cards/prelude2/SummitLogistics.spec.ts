import {expect} from 'chai';
import {SummitLogistics} from '@/server/cards/prelude2/SummitLogistics';
import {PartyName} from '@/common/turmoil/PartyName';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {setRulingParty} from '../../TestingUtils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {Sponsors} from '@/server/cards/base/Sponsors';
import {AsteroidMiningConsortium} from '@/server/cards/base/AsteroidMiningConsortium';
import {VenusianInsects} from '@/server/cards/venusNext/VenusianInsects';
import {MartianCensus} from '@/server/cards/turmoilRedux/MartianCensus';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {Parliament} from '@/server/parliament/Parliament';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
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

describe('SummitLogistics', () => {
  let card: SummitLogistics;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new SummitLogistics();
    [game, player] = testGame(2, {turmoilExtension: true, coloniesExtension: true});
  });

  it('canPlay', () => {
    setRulingParty(game, PartyName.REDS);
    expect(card.canPlay(player)).is.false;

    setRulingParty(game, PartyName.SCIENTISTS);
    expect(card.canPlay(player)).is.true;
  });

  it('play() draws 2 cards', () => {
    expect(player.cardsInHand).has.lengthOf(0);
    card.play(player);
    expect(player.cardsInHand).has.lengthOf(2);
  });

  it('play() grants 1 M€ per JOVIAN, EARTH, VENUS, and MARS tag', () => {
    player.tagsForTest = {
      'jovian': 1,
      'earth': 2,
      'venus': 1,
      'mars': 1,
    };
    card.play(player);
    expect(player.megaCredits).to.eq(5);
  });

  it('does not count Moon tags', () => {
    player.tagsForTest = {'moon': 5};
    card.play(player);
    expect(player.megaCredits).to.eq(0);
  });
});

/**
 * P85 — SUMMIT LOGISTICS IN THE PREMIUM SCOPE: the SECOND Prelude 2 card adapted IN PLACE and the FIRST
 * POLITICAL one (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5). The rules did not change: the party
 * requirement reads the facade (`PartyRequirement` → `game.politics.satisfiesPartyRequirement` — the
 * Scientists rule, or 2 of the player's delegates on their resolution), the gain is ONE countable with TWO
 * bases (the player's planet tags — Jovian, Earth, Venus OR Mars — and the player's colonies), the draw is a
 * plain `drawCard: 2`. The work was the marker (`politics: 'redux'`), the honest face (Mars is a live tag in
 * this fork) and the reading of a two-term count (`countableBasis` — `tags`, and no colony term on a table
 * without colonies).
 */
describe('SummitLogistics — on a Turmoil Redux table', () => {
  const S = PartyName.SCIENTISTS;
  /**
   * THE SCIENTISTS' EFFECT IS «+1 WILD TAG» (Redux — `PartyEffects` → `ParliamentHandler.wildTags`), and a wild tag
   * is a planet tag for this count: wherever the card is PLAYABLE (the Scientists rule, or two delegates — both roads
   * give the effect), the count carries ONE more than the planet tags on the table. Named here, never worked around.
   */
  const SCIENTISTS_WILD = 1;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: SummitLogistics};

  /** A two-seat Redux + Prelude 2 table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new SummitLogistics();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** The same table with three QUIET real resolutions up for the vote (the Scientists · Mars First · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([S, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** The Scientists rule: their quiet resolution stands enacted. */
  function scientistsRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(S));
    expect(t.parliament.rulingParty()).eq(S);
    return t;
  }

  /** The second road: two of p1's delegates on the Scientists' resolution (slot 0). */
  function twoDelegates(t: Table): Table {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
    return t;
  }

  /** One planet tag of each kind on p1's table — a Mars card of the Redux set among them. */
  function planets(t: Table): void {
    t.p1.playedCards.push(new AsteroidMiningConsortium(), new Sponsors(), new VenusianInsects(), new MartianCensus());
  }

  /** `n` colonies of `who` (one cube on each of the table's first tiles). */
  function colonies(t: Table, n: number, who: TestPlayer = t.p1): void {
    for (let i = 0; i < n; i++) {
      t.game.colonies[i].addColony(who);
    }
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const gainOf = (effects: ReadonlyArray<ActionEffect>, icon: string) => effects.find((e) => e.direction === 'gain' && e.icon === icon);

  it('rule 1 — the printed card: green, 10, Building + Space, no VP, the Scientists\' plate, P85; political, marked for Redux', () => {
    const c = new SummitLogistics();
    expect(c.name).eq(CardName.SUMMIT_LOGISTICS);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(10);
    expect(c.tags).deep.eq([Tag.BUILDING, Tag.SPACE]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(S);
    expect(c.metadata.cardNumber).eq('P85');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.SUMMIT_LOGISTICS];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  it('rule 1 — the face says what is counted: Jovian, Earth, Venus AND Mars, then the colony; no prose on the face', () => {
    const c = new SummitLogistics();
    const json = JSON.stringify(c.metadata.renderData);
    const tags = [...json.matchAll(/"tag":"([a-z]+)"/g)].map((m) => m[1]);
    expect(tags).deep.eq([Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS]);
    expect(json).not.include('FAN EXPANSION NOTE');
    expect(json, 'the rule lives in `description`, not in a `plainText` row').not.include('Requires that');
    expect(c.metadata.description).include('(Jovian, Earth, Venus or Mars)');
  });

  describe('rule 2 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, current: 1});
    });

    it('the Scientists\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.MARS, PartyName.GREENS, PartyName.UNITY] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Scientists rule: playable', () => {
      const t = scientistsRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Scientists EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, S, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, S)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('paid with M€, steel (a Building tag) AND titanium (a Space tag) — both alternative sources are offered', () => {
      const t = scientistsRuling();
      const options = t.p1.paymentOptionsForCard(t.card);
      expect(options.steel).is.true;
      expect(options.titanium).is.true;
    });
  });

  describe('rule 3 — 1 M€ for each of YOUR planet tags and each of YOUR colonies, then draw 2', () => {
    it('Jovian + Earth + Venus + Mars (a Redux Mars card) + the Scientists\' wild tag + 2 colonies = 7 M€, and two cards in the hand', () => {
      const t = scientistsRuling();
      planets(t);
      colonies(t, 2);
      const mc = t.p1.megaCredits;
      const hand = t.p1.cardsInHand.length;
      play(t);
      expect(t.p1.megaCredits - mc, '(`playCard` takes no payment — the gain alone)').eq(4 + SCIENTISTS_WILD + 2);
      expect(t.p1.cardsInHand.length - (hand - 1), 'the card left the hand, two came in').eq(2);
      expect(t.p1.tableau.has(CardName.SUMMIT_LOGISTICS)).is.true;
    });

    it('an EVENT\'s planet tag does not count; a printed WILD tag counts once, beside the Scientists\' one', () => {
      const t = scientistsRuling();
      t.p1.playedCards.push(fakeCard({name: 'earth event' as CardName, type: CardType.EVENT, tags: [Tag.EARTH]}));
      t.p1.playedCards.push(fakeCard({name: 'wild own' as CardName, tags: [Tag.WILD]}));
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc).eq(1 + SCIENTISTS_WILD);
    });

    it('an opponent\'s planet tags and colonies do not count', () => {
      const t = scientistsRuling();
      t.p2.playedCards.push(new Sponsors(), new MartianCensus());
      colonies(t, 2, t.p2);
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc, 'the Scientists\' wild tag alone').eq(SCIENTISTS_WILD);
    });

    it('two cubes of the player\'s on ONE tile are two colonies (the engine\'s one reading — `coloniesOf`)', () => {
      const t = scientistsRuling();
      t.game.colonies[0].addColony(t.p1);
      t.game.colonies[0].addColony(t.p1);
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc).eq(2 + SCIENTISTS_WILD);
    });

    it('the second road gives the effect too: two delegates, nothing on the table → the wild tag alone pays 1', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.game.politics!.hasPartyEffect(t.p1, S)).is.true;
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc).eq(SCIENTISTS_WILD);
    });

    it('nothing counted (a classic table — no wild tag): an honest ZERO — no M€ event, the draw still pays', () => {
      const [game, p1] = testGame(2, {turmoilExtension: true, coloniesExtension: true, prelude2Expansion: true});
      game.phase = Phase.ACTION;
      setRulingParty(game, PartyName.SCIENTISTS);
      const c = new SummitLogistics();
      p1.cardsInHand.push(c);
      expect(gainOf(countedPlayEffects(p1, c), 'megacredits')?.basis).deep.eq([
        {count: 0, label: 'Your tags', tags: [Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS]},
        {count: 0, label: 'Your colonies'},
      ]);
      const from = game.events.events.length;
      const mc = p1.megaCredits;
      p1.playCard(c);
      runAllActions(game);
      expect(p1.megaCredits).eq(mc);
      const mine = game.events.events.slice(from).filter((e) => e.player === p1.color);
      expect(mine.some((e) => e.type === 'resource-changed' && (e.impact?.stock?.megacredits ?? 0) !== 0), 'no «+0» in the journal').is.false;
      expect(mine.filter((e) => e.type === 'cards-drawn').map((e) => e.impact.cardsDrawn)).deep.eq([2]);
    });

    it('the journal: the M€ first (`stock.add`), the draw after — and ONE reveal batch, sourced by the card', () => {
      const t = scientistsRuling();
      planets(t);
      const from = t.game.events.events.length;
      play(t);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      const mc = mine.findIndex((e) => e.type === 'resource-changed' && (e.impact?.stock?.megacredits ?? 0) > 0);
      const drawn = mine.findIndex((e) => e.type === 'cards-drawn');
      expect(mc, JSON.stringify(mine.map((e) => e.type))).gte(0);
      expect(mc, JSON.stringify(mine.map((e) => e.type))).lt(drawn);
      expect(t.p1.cardDrawReveals).has.length(1);
      expect(t.p1.cardDrawReveals[0].source).deep.eq({type: 'card', cardName: CardName.SUMMIT_LOGISTICS});
      expect(t.p1.cardDrawReveals[0].cards).has.length(2);
      expect(t.p1.cardDrawReveals[0].search, 'a plain draw — no search rule').is.undefined;
    });
  });

  describe('rule 4 — the forecast before the press: «+N M€» with BOTH terms of its basis, and «+2 cards»', () => {
    it('the play preview: the M€ chip names the planet tags (a ROW — `tags`, the wild share NAMED) and the colonies, each with its server count; read-only', () => {
      const t = scientistsRuling();
      planets(t);
      colonies(t, 2);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      const mc = gainOf(effects, 'megacredits');
      expect(mc?.amount, JSON.stringify(effects)).eq(7);
      expect(mc?.basis, 'four planet tags on the table + the Scientists\' wild tag').deep.eq([
        {count: 5, label: 'Your tags', tags: [Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS], wild: SCIENTISTS_WILD},
        {count: 2, label: 'Your colonies'},
      ]);
      expect(gainOf(effects, 'cards')).deep.include({amount: 2, note: 'draw'});
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('the hand reads the same counted number off the server (`countedPlayEffects` → `CardModel.countedPlay`)', () => {
      const t = scientistsRuling();
      planets(t);
      colonies(t, 1);
      const counted = gainOf(countedPlayEffects(t.p1, t.card), 'megacredits');
      expect(counted?.amount).eq(4 + SCIENTISTS_WILD + 1);
      expect(counted?.basis?.map((b) => b.count)).deep.eq([4 + SCIENTISTS_WILD, 1]);
    });

    it('nothing on the table: the chip reads the wild tag alone («1, of which wild 1») and the colonies at 0', () => {
      const t = scientistsRuling();
      const mc = gainOf(countedPlayEffects(t.p1, t.card), 'megacredits');
      expect(mc?.amount).eq(SCIENTISTS_WILD);
      expect(mc?.basis).deep.eq([
        {count: 1, label: 'Your tags', tags: [Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS], wild: 1},
        {count: 0, label: 'Your colonies'},
      ]);
    });
  });

  it('rule 4 — a table WITHOUT colonies: the planet tags count, and the basis names NO colony term (a term without its entity is not a term)', () => {
    const [game, p1] = testGame(2, {turmoilExtension: true, prelude2Expansion: true});
    expect(game.gameOptions.coloniesExtension).is.false;
    setRulingParty(game, PartyName.SCIENTISTS);
    const c = new SummitLogistics();
    p1.cardsInHand.push(c);
    p1.playedCards.push(new Sponsors());
    const mc = gainOf(countedPlayEffects(p1, c), 'megacredits');
    expect(mc?.amount).eq(1);
    expect(mc?.basis).deep.eq([{count: 1, label: 'Your tags', tags: [Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS]}]);
  });

  describe('rule 5 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.SUMMIT_LOGISTICS);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.SUMMIT_LOGISTICS);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.SUMMIT_LOGISTICS)).is.false;
    });

    it('save / reload: the card in the tableau, the drawn cards in the hand, the M€ kept', () => {
      const t = scientistsRuling();
      planets(t);
      play(t);
      const mc = t.p1.megaCredits;
      const hand = t.p1.cardsInHand.map((c) => c.name);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.tableau.has(CardName.SUMMIT_LOGISTICS)).is.true;
      expect(owner.cardsInHand.map((c) => c.name)).deep.eq(hand);
      expect(owner.megaCredits).eq(mc);
    });

    it('MarsBot at the table (the card brought in by hand): the count is the HUMAN\'s own tags — the bot\'s Earth track does not pay', () => {
      const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([S, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(S));
      const board = game.automa!.board;
      const earth = board.getTrackIndexForTag(Tag.EARTH);
      expect(earth).is.not.undefined;
      board.tracks[earth!].position = 3;
      const c = new SummitLogistics();
      human.cardsInHand.push(c);
      human.playedCards.push(new Sponsors());
      human.megaCredits = 20;
      expect(human.canPlay(c)).is.true;
      human.playCard(c);
      runAllActions(game);
      expect(human.megaCredits, 'its one Earth tag and the Scientists\' wild tag — never the bot\'s track').eq(20 + 1 + SCIENTISTS_WILD);
    });
  });
});
