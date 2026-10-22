import {expect} from 'chai';
import {WildlifeDome} from '../../../src/server/cards/turmoil/WildlifeDome';
import {IGame} from '../../../src/server/IGame';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {PoliticalAgendas} from '../../../src/server/turmoil/PoliticalAgendas';
import {runAllActions, testGame} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {IParty} from '../../../src/server/turmoil/parties/IParty';
import {cast} from '../../../src/common/utils/utils';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ratingVetoed} from '../../../src/server/parliament/ratingVetoGate';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {TileType} from '../../../src/common/TileType';
import {SpaceId} from '../../../src/common/Types';
import {addCity, setOxygenLevel} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('WildlifeDome', () => {
  let card: WildlifeDome;
  let player: TestPlayer;
  let game: IGame;
  let turmoil: Turmoil;
  let reds: IParty;
  let greens: IParty;

  beforeEach(() => {
    card = new WildlifeDome();
    [game, player/* , player2 */] = testGame(2, {turmoilExtension: true});
    turmoil = game.turmoil!;
    reds = turmoil.getPartyByName(PartyName.REDS);
    greens = turmoil.getPartyByName(PartyName.GREENS);
  });

  it('Should play: reds', () => {
    turmoil.rulingParty = reds;
    PoliticalAgendas.setNextAgenda(turmoil, game);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Play when greens are in power', () => {
    game.phase = Phase.ACTION;
    turmoil.rulingParty = greens;
    PoliticalAgendas.setNextAgenda(turmoil, game);

    player.megaCredits = 15;
    expect(player.canPlay(card)).is.true;

    cast(card.play(player), undefined);
    runAllActions(player.game);
    const action = cast(player.popWaitingFor(), SelectSpace);

    action.cb(action.spaces[0]);
    expect(game.getOxygenLevel()).to.eq(1);
  });

  it('Should play: reds in power, 2 green delegates', () => {
    game.phase = Phase.ACTION;
    turmoil.rulingParty = reds;
    PoliticalAgendas.setNextAgenda(turmoil, game);

    greens.delegates.add(player, 2);
    expect(player.canPlay(card)).is.not.true;

    player.megaCredits = 17;
    expect(player.canPlay(card)).is.not.true;

    player.megaCredits = 18;
    expect(player.canPlay(card)).is.true;
    expect(card.additionalProjectCosts).deep.eq({redsCost: 3});
  });
});

/**
 * T15 — WILDLIFE DOME ON A TURMOIL REDUX TABLE: the seventh classic Turmoil
 * card adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The card
 * file did not change its rules: the party requirement reads the facade
 * (`PartyRequirement` → `game.politics.satisfiesPartyRequirement`) and the body
 * is the declarative `greenery: {}` — so the play is a STAGED PLAY (the cell is
 * the last reversible step, `stagedPlacementForBehavior`), and the greenery is
 * the Redux greenery: +1 TR for the oxygen step and +1 TR for the tile itself
 * (`REDUX_GREENERY_TILE_TR`), the tile's TR alone at the oxygen maximum. Every
 * rule of the reading is pinned here.
 */
describe('WildlifeDome — on a Turmoil Redux table', () => {
  const G = PartyName.GREENS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: WildlifeDome};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 30 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new WildlifeDome();
    p1.cardsInHand.push(card);
    p1.megaCredits = 30;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /**
   * The same table with three QUIET real resolutions up for the vote (the Greens · Unity · the Scientists) and
   * Unity's quiet law ENACTED — the Greens rule a fresh Redux table (the starting ruler), so «neither road» needs
   * another party in power.
   */
  function parliamentTable(): Table {
    const t = table();
    ([G, PartyName.UNITY, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
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

  /** The board step of the play's preview (the one cell pick before the one POST). */
  function placementStep(t: Table) {
    const steps = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.steps ?? []);
    const placement = steps.find((s) => s.kind === 'boardPlacement');
    return placement?.kind === 'boardPlacement' ? placement : undefined;
  }

  /** Play the card for real and answer its cell (the first legal one unless named). */
  function playOn(t: Table, spaceId?: SpaceId): SpaceId {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    const ask = cast(t.p1.getWaitingFor(), SelectSpace);
    const id = spaceId ?? ask.spaces[0].id;
    t.p1.process({type: 'space', spaceId: id});
    runAllActions(t.game);
    return id;
  }

  /** The rating events p1 gained from `from` on, with their sources. */
  function ratingEvents(t: Table, from: number) {
    return t.game.events.events.slice(from).filter((e) => e.type === 'tr-changed' && e.player === t.p1.color);
  }

  it('rule 1 — the printed card: green, 15, Animal + Plant + Building, no VP, the Greens\' plate; the printed number is T15', () => {
    const c = new WildlifeDome();
    expect(c.name).eq(CardName.WILDLIFE_DOME);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(15);
    expect(c.tags).deep.eq([Tag.ANIMAL, Tag.PLANT, Tag.BUILDING]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(G);
    expect(c.metadata.cardNumber).eq('T15');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.WILDLIFE_DOME]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: the Greens rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, current: 1});
    });

    it('the Greens\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.UNITY, PartyName.SCIENTISTS, PartyName.MARS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      seatEnacted(t.parliament, quietResolutionOf(PartyName.UNITY));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
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
  });

  describe('rule 2 — the play is STAGED: the cell is the last reversible step', () => {
    it('the preview carries the staged greenery — the legal set IS the live prompt\'s, sourced by the card, read-only', () => {
      const t = greensRuling();
      const before = JSON.stringify(t.game.serialize());
      const step = placementStep(t);
      expect(step?.tileType, 'the identity is the TILE').eq(TileType.GREENERY);
      const staged = step?.staged;
      expect(staged, 'the play stages its cell').is.not.undefined;
      expect(staged!.sourceCard).eq(CardName.WILDLIFE_DOME);
      expect(staged!.tileType).eq(TileType.GREENERY);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const live = cast(t.p1.getWaitingFor(), SelectSpace);
      expect([...staged!.spaces].sort(), 'pre-pay set == post-pay set').deep.eq(live.spaces.map((s) => s.id).sort());
    });

    it('beside one\'s own tile the legal set is the cells next to it (the greenery\'s adjacency rule, the live engine\'s)', () => {
      const t = greensRuling();
      const own = addCity(t.p1);
      const staged = placementStep(t)?.staged;
      const neighbours = new Set(t.game.board.getAdjacentSpaces(own).map((s) => s.id));
      expect(staged!.spaces.length).is.greaterThan(0);
      expect(staged!.spaces.every((id) => neighbours.has(id)), JSON.stringify(staged!.spaces)).is.true;
    });

    it('the cell confirmed: the greenery is p1\'s, oxygen +1, the rating +2 from TWO sources — the oxygen step and the Redux tile', () => {
      const t = greensRuling();
      const tr = t.p1.terraformRating;
      const from = t.game.events.events.length;
      const id = playOn(t);
      const space = t.game.board.getSpaceOrThrow(id);
      expect(space.tile?.tileType).eq(TileType.GREENERY);
      expect(space.player).eq(t.p1);
      expect(t.game.getOxygenLevel()).eq(1);
      expect(t.p1.terraformRating - tr).eq(2);
      const events = ratingEvents(t, from);
      expect(events.map((e) => e.impact.tr), JSON.stringify(events)).deep.eq([1, 1]);
      expect(events.filter((e) => e.source?.kind === 'parliament' && e.source.rule === 'greenery-tile'), 'one of them is the tile\'s, named').has.length(1);
      expect(t.p1.tableau.has(CardName.WILDLIFE_DOME)).is.true;
    });

    it('at the oxygen MAXIMUM the tile still pays its own +1 TR; the oxygen does not move', () => {
      const t = greensRuling();
      setOxygenLevel(t.game, 14);
      const tr = t.p1.terraformRating;
      const from = t.game.events.events.length;
      playOn(t);
      expect(t.game.getOxygenLevel()).eq(14);
      expect(t.p1.terraformRating - tr).eq(1);
      expect(ratingEvents(t, from).map((e) => e.source)).deep.eq([{kind: 'parliament', rule: 'greenery-tile'}]);
    });

    it('a play under the second road keeps the delegates where they stand (the requirement reads, it never spends)', () => {
      const t = twoDelegates(parliamentTable());
      const before = JSON.stringify(t.parliament.slots[0]);
      playOn(t);
      expect(JSON.stringify(t.parliament.slots[0])).eq(before);
    });
  });

  describe('rule 3 — no legal cell: the card is NOT playable, and the hand names why (nothing is lost silently)', () => {
    it('every land cell taken: unplayable, «No space available for the tile» — never a play whose tile is skipped', () => {
      const t = greensRuling();
      for (const space of t.game.board.getAvailableSpacesForGreenery(t.p1)) {
        t.game.simpleAddTile(t.p2, space, {tileType: TileType.CITY});
      }
      expect(t.game.board.getAvailableSpacesForGreenery(t.p1)).deep.eq([]);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: 'No space available for the tile'}]);
    });
  });

  describe('rule 2 under the replacing law — both ratings go through the ONE funnel', () => {
    it('RX42 UNMI Veto (the Reds rule, p1 FIRST by rating, the second road open): the tile is seated, the oxygen rises, BOTH ratings refused; the preview strikes them', () => {
      const t = parliamentTable();
      seatEnacted(t.parliament, UNMI_VETO_ID);
      twoDelegates(t);
      t.p1.terraformRating = 30;
      t.p2.terraformRating = 20;
      expect(ratingVetoed(t.p1)).is.true;
      expect(t.p1.canPlay(t.card), 'the second road is the way in while the Reds rule').is.true;
      const ratings = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects).filter((e) => e.icon === 'tr' && e.direction === 'gain');
      expect(ratings.map((e) => e.amount), 'the oxygen step\'s and the tile\'s').deep.eq([1, 1]);
      expect(ratings.every((e) => e.vetoed?.resolution === UNMI_VETO_ID), JSON.stringify(ratings)).is.true;
      const id = playOn(t);
      expect(t.game.board.getSpaceOrThrow(id).tile?.tileType).eq(TileType.GREENERY);
      expect(t.game.getOxygenLevel()).eq(1);
      expect(t.p1.terraformRating, 'nothing gained').eq(30);
    });
  });

  it('rule 2 with MarsBot at the table: the human\'s greenery, +2 TR', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([G, PartyName.UNITY, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(G));
    const c = new WildlifeDome();
    human.cardsInHand.push(c);
    human.megaCredits = 30;
    const tr = human.terraformRating;
    expect(human.canPlay(c)).is.true;
    human.playCard(c);
    runAllActions(game);
    const ask = cast(human.getWaitingFor(), SelectSpace);
    human.process({type: 'space', spaceId: ask.spaces[0].id});
    runAllActions(game);
    expect(human.terraformRating - tr).eq(2);
  });

  it('rule 4 — save / reload: the card in the tableau with its three tags, the greenery on its cell', () => {
    const t = greensRuling();
    const id = playOn(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.WILDLIFE_DOME)).is.not.undefined;
    expect([Tag.ANIMAL, Tag.PLANT, Tag.BUILDING].map((tag) => owner.tags.count(tag, 'raw'))).deep.eq([1, 1, 1]);
    expect(reloaded.board.getSpaceOrThrow(id).tile?.tileType).eq(TileType.GREENERY);
    expect(reloaded.getOxygenLevel()).eq(1);
  });
});
