import {expect} from 'chai';
import {
  ADMINISTRATION_DISTRICT_TITLE, AdministrationDistrict, NO_CITY_ON_MARS_REASON, NO_SPACE_BESIDE_YOUR_CITY_REASON,
  isBuildingCardWithNonNegativeVpIcon,
} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Space} from '../../../src/server/boards/Space';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {NoctisFarming} from '../../../src/server/cards/base/NoctisFarming';
import {BiomassCombustors} from '../../../src/server/cards/base/BiomassCombustors';
import {Capital} from '../../../src/server/cards/base/Capital';
import {RoverConstruction} from '../../../src/server/cards/base/RoverConstruction';
import {Pets} from '../../../src/server/cards/base/Pets';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {TileType} from '../../../src/common/TileType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, addOcean, fakeCard, runAllActions} from '../../TestingUtils';
import {CityNeighbourhood, cityNeighbourhood} from '../../boards/cityNeighbourhood';

/**
 * TR16 — ADMINISTRATION DISTRICT: the set's first city «IGNORING OTHER
 * PLACEMENT RESTRICTIONS» (beside one's own city) and its first trigger on «a
 * Building card with a NON-NEGATIVE VP icon». Every rule reading of the card
 * file's header is pinned here; the cell rule itself has its own spec
 * (tests/boards/ignoreRestrictionsCity.spec.ts).
 */
const M = PartyName.MARS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: AdministrationDistrict};

function table(options?: {redux?: boolean}): Table {
  const [game, p1, p2] = testGame(2, options?.redux === true ? {turmoilReduxExpansion: true, coloniesExtension: true} : {});
  game.phase = Phase.ACTION;
  return {game, p1, p2, card: new AdministrationDistrict()};
}

/** An interior land cell: six neighbours, every one plain empty land. */
function interiorLand(game: IGame): Space {
  const board = game.board;
  const found = board.spaces.find((space) => space.spaceType === SpaceType.LAND && space.tile === undefined &&
    board.getAdjacentSpaces(space).length === 6 &&
    board.getAdjacentSpaces(space).every((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
      s.id !== board.noctisCitySpaceId));
  if (found === undefined) {
    throw new Error('no interior land cell');
  }
  return found;
}

/** Own city O (p1), another player's city F (p2); X beside both, Y beside F only. */
function arranged(t: Table): CityNeighbourhood {
  const hood = cityNeighbourhood(t.game);
  addCity(t.p1, hood.own.id);
  addCity(t.p2, hood.foreign.id);
  return hood;
}

/** Play the card for real (no requirement asked — `playCard` is past the gate) and return its cell prompt. */
function playToPrompt(t: Table): SelectSpace {
  t.p1.playCard(t.card);
  runAllActions(t.game);
  return cast(t.p1.popWaitingFor(), SelectSpace);
}

/** A two-seat Redux table with three QUIET real resolutions (Greens · Mars First · Industrialists), 40 M€. */
function parliamentTable(): Table {
  const t = table({redux: true});
  const parliament = t.game.parliament!;
  ([PartyName.GREENS, M, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  t.p1.megaCredits = 40;
  return t;
}

/** The same table with Mars First RULING — the requirement met, so only the cell rule decides. */
function marsFirstRules(): Table {
  const t = parliamentTable();
  seatEnacted(t.game.parliament!, quietResolutionOf(M));
  return t;
}

function stagedOf(player: TestPlayer, card: IProjectCard) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  const placement = steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
  return placement?.staged;
}

describe('AdministrationDistrict', () => {
  it('registers with source-backed metadata (the scan: 18 · Mars, City, Building · blue · Mars First · no VP)', () => {
    const card = new AdministrationDistrict();
    expect(card.name).eq(CardName.ADMINISTRATION_DISTRICT);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(18);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.MARS, Tag.CITY, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR16');
    expect(requiredPartyOf(card), 'the MIN plate holds the Mars First emblem').eq(M);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.resourceType).is.undefined;
    // The face: the effect «[Building card with a VP icon] : [card]», then the play «[city]*».
    type Node = {is?: string, type?: string, secondaryTag?: Tag, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    const effect = rows[0][0];
    expect(effect.is).eq('effect');
    const cause = (effect.rows?.[0] ?? []) as Array<Node>;
    const result = (effect.rows?.[2] ?? []) as Array<Node | string>;
    expect(cause[0]).deep.include({type: CardRenderItemType.VP_CARD, secondaryTag: Tag.BUILDING});
    expect((result[0] as Node).type).eq(CardRenderItemType.CARDS);
    expect(result).deep.include('Effect: After you play a Building card that has a NON-NEGATIVE VP icon, draw a card.');
    expect(rows[1].map((n) => n.type ?? n.is)).deep.eq([CardRenderItemType.CITY, '*']);
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    function reduxTable(): Table {
      const t = parliamentTable();
      addCity(t.p1, interiorLand(t.game).id);
      return t;
    }

    it('neither road: unplayable with the TR15 class\'s NAMED reason', () => {
      const t = reduxTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Mars First rules: playable', () => {
      const t = reduxTable();
      seatEnacted(t.game.parliament!, quietResolutionOf(M));
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = reduxTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      parliament.placeVote(t.p1, parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rule 3 — no own city on Mars, or no cell beside one: ONE named reason', () => {
    it('no city of one\'s own on Mars (another player\'s city, an off-Mars city of one\'s own do not help)', () => {
      const t = marsFirstRules();
      addCity(t.p2, interiorLand(t.game).id);
      t.game.addCity(t.p1, t.game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'placement', message: NO_CITY_ON_MARS_REASON});
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_CITY_ON_MARS_REASON}]);
    });

    it('an own city with every neighbour taken: «no free space adjacent to one of your cities»', () => {
      const t = marsFirstRules();
      const own = interiorLand(t.game);
      addCity(t.p1, own.id);
      for (const n of t.game.board.getAdjacentSpaces(own)) {
        n.tile = {tileType: TileType.GREENERY};
      }
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_BESIDE_YOUR_CITY_REASON}]);
    });

    it('a free cell beside one\'s city: playable, no reason', () => {
      const t = marsFirstRules();
      addCity(t.p1, interiorLand(t.game).id);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(t.card.unplayableReason(t.p1)).is.undefined;
    });
  });

  describe('rule 2 — the cells: beside one\'s OWN city, the city rule lifted, the reservations kept', () => {
    it('beside own — yes; beside own AND another player\'s — yes; beside another player\'s only — no, with the reason', () => {
      const t = table();
      const {shared, foreignOnly} = arranged(t);
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(ADMINISTRATION_DISTRICT_TITLE);
      expect(prompt.sourceCard, 'the staged tail\'s address').eq(CardName.ADMINISTRATION_DISTRICT);
      const legal = prompt.spaces.map((s) => s.id);
      expect(legal).to.include(shared.id);
      expect(legal).to.not.include(foreignOnly.id);
      expect(prompt.illegalSpaces?.find((e) => e.spaceId === foreignOnly.id)?.reason).eq('not-adjacent-to-your-city');
      expect(prompt.illegalSpaces?.map((e) => e.reason), 'the lifted rule is never quoted').to.not.include('adjacent-to-city');
    });

    it('an ocean cell, Noctis and an occupied cell stay out, each with its own reason', () => {
      const t = table();
      const board = t.game.board;
      const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== board.noctisCitySpaceId;
      const noctis = board.getSpaceOrThrow(SpaceName.NOCTIS_CITY);
      addCity(t.p1, board.getAdjacentSpaces(noctis).filter(free)[0].id);
      const ocean = board.spaces.filter((s) => s.spaceType === SpaceType.OCEAN && board.getAdjacentSpaces(s).some(free))[0];
      const besideOcean = board.getAdjacentSpaces(ocean).filter(free)[0];
      addCity(t.p1, besideOcean.id);
      const occupied = board.getAdjacentSpaces(besideOcean).filter(free)[0];
      occupied.tile = {tileType: TileType.GREENERY};
      const prompt = playToPrompt(t);
      const legal = prompt.spaces.map((s) => s.id);
      const reasonOf = (space: Space) => prompt.illegalSpaces?.find((e) => e.spaceId === space.id)?.reason;
      expect(legal).to.not.include.members([noctis.id, ocean.id, occupied.id]);
      expect(reasonOf(noctis)).eq('reserved-noctis');
      expect(reasonOf(ocean)).eq('ocean-only');
      expect(reasonOf(occupied)).eq('occupied');
    });

    it('the Capital is one\'s city', () => {
      const t = table();
      const capital = interiorLand(t.game);
      t.game.addTile(t.p1, capital, {tileType: TileType.CAPITAL});
      const legal = playToPrompt(t).spaces.map((s) => s.id);
      expect(legal).to.have.members(t.game.board.getAdjacentSpaces(capital).map((s) => s.id));
    });

    it('the staged preview offers the SAME cells and the SAME reasons as the live prompt (parity)', () => {
      const t = table();
      t.p1.megaCredits = 40;
      arranged(t);
      const staged = stagedOf(t.p1, t.card);
      expect(staged, 'the play stages its city').is.not.undefined;
      expect(staged?.title).eq(ADMINISTRATION_DISTRICT_TITLE);
      expect(staged?.placementType).eq('city');
      expect(staged?.sourceCard).eq(CardName.ADMINISTRATION_DISTRICT);
      const prompt = playToPrompt(t);
      expect(staged?.spaces).to.have.members(prompt.spaces.map((s) => s.id));
      expect(staged?.illegalSpaces).deep.eq(prompt.illegalSpaces);
      expect(staged?.tileType).eq(prompt.tileType);
    });
  });

  describe('rule 4 — the placement gives what an ordinary city gives', () => {
    it('the cell\'s bonus, and every city trigger (Rover Construction, Pets, Martian Census)', () => {
      const t = table();
      const {shared} = arranged(t);
      shared.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL];
      const rover = new RoverConstruction();
      const pets = new Pets();
      const census = new MartianCensus();
      t.p1.playedCards.push(rover, pets, census);
      const steel = t.p1.steel;
      const mc = t.p1.megaCredits;
      const prompt = playToPrompt(t);
      prompt.cb(prompt.spaces.find((s) => s.id === shared.id)!);
      runAllActions(t.game);
      expect(shared.tile?.tileType).eq(TileType.CITY);
      expect(shared.player).eq(t.p1);
      expect(t.p1.steel - steel, 'the printed bonus').eq(2);
      expect(t.p1.megaCredits - mc, 'Rover Construction').eq(2);
      expect(pets.resourceCount, 'Pets').eq(1);
      expect(census.resourceCount, 'Martian Census (a city on Mars)').eq(1);
    });

    it('ocean adjacency pays as usual', () => {
      const t = table();
      const board = t.game.board;
      const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== board.noctisCitySpaceId;
      // A free land cell X with an ocean cell beside it and a free land cell for one's own city beside it.
      const x = board.spaces.filter((s) => free(s) && s.bonus.length === 0 &&
        board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.OCEAN) &&
        board.getAdjacentSpaces(s).some(free))[0];
      addOcean(t.p2, board.getAdjacentSpaces(x).filter((n) => n.spaceType === SpaceType.OCEAN)[0].id);
      const own = board.getAdjacentSpaces(x).filter(free)[0];
      addCity(t.p1, own.id);
      const mc = t.p1.megaCredits;
      const prompt = playToPrompt(t);
      prompt.cb(prompt.spaces.find((s) => s.id === x.id)!);
      runAllActions(t.game);
      expect(t.p1.megaCredits - mc).eq(2);
    });
  });

  describe('rules 5–6 — the trigger: the OWNER plays a Building card with a non-negative VP icon → draw 1', () => {
    function owned(): Table {
      const t = table();
      t.p1.playedCards.push(t.card);
      return t;
    }

    function drawnBy(t: Table, player: TestPlayer, card: IProjectCard): number {
      const before = t.p1.cardsInHand.length;
      player.playCard(card);
      runAllActions(t.game);
      return t.p1.cardsInHand.length - before;
    }

    const cases: ReadonlyArray<[string, () => IProjectCard, number]> = [
      ['a fixed 1 VP (Noctis Farming)', () => new NoctisFarming(), 1],
      ['a fixed 0 VP', () => fakeCard({tags: [Tag.BUILDING], victoryPoints: 0}), 1],
      ['a variable «1 per …» (Capital)', () => new Capital(), 1],
      ['a variable formula with a negative sign', () => fakeCard({tags: [Tag.BUILDING], victoryPoints: {cities: {}, each: -1}}), 0],
      ['no VP icon', () => fakeCard({tags: [Tag.BUILDING]}), 0],
      ['a negative VP (Biomass Combustors)', () => new BiomassCombustors(), 0],
      ['a bespoke icon declared non-negative', () => fakeCard({tags: [Tag.BUILDING], victoryPoints: 'special', victoryPointsSign: 'nonNegative'}), 1],
      ['a bespoke icon with no declared sign', () => fakeCard({tags: [Tag.BUILDING], victoryPoints: 'special'}), 0],
      ['a bespoke icon that can be either sign', () => fakeCard({tags: [Tag.BUILDING], victoryPoints: 'special', victoryPointsSign: 'either'}), 0],
      ['a VP card with no Building tag', () => fakeCard({tags: [Tag.SCIENCE], victoryPoints: 1}), 0],
      ['a wild tag is not a Building tag', () => fakeCard({tags: [Tag.WILD], victoryPoints: 1}), 0],
      ['a Building EVENT with a non-negative VP icon', () => fakeCard({type: CardType.EVENT, tags: [Tag.BUILDING], victoryPoints: 1}), 1],
    ];
    for (const [label, make, drawn] of cases) {
      it(`${label}: ${drawn === 0 ? 'nothing' : '+1 card'}`, () => {
        const t = owned();
        const card = make();
        expect(isBuildingCardWithNonNegativeVpIcon(card)).eq(drawn === 1);
        expect(drawnBy(t, t.p1, card)).eq(drawn);
      });
    }

    it('the draw reveals as this card\'s', () => {
      const t = owned();
      drawnBy(t, t.p1, new NoctisFarming());
      expect(t.p1.cardDrawReveals.at(-1)?.source).deep.eq({type: 'card', cardName: CardName.ADMINISTRATION_DISTRICT});
    });

    it('another player\'s play: nothing for the owner', () => {
      const t = owned();
      expect(drawnBy(t, t.p2, new NoctisFarming())).eq(0);
    });

    it('the card never triggers itself (no VP icon)', () => {
      const t = table();
      addCity(t.p1, interiorLand(t.game).id);
      const prompt = playToPrompt(t);
      prompt.cb(prompt.spaces.find((s) => !s.bonus.includes(SpaceBonus.DRAW_CARD))!);
      runAllActions(t.game);
      expect(t.p1.cardsInHand).is.empty;
    });

    it('the forecast twin: an exact «+1 card» for a qualifying play, nothing otherwise — and the play draws exactly that', () => {
      const t = owned();
      t.p1.megaCredits = 40;
      const forecastOf = (card: IProjectCard) => effectForecastForPlay(t.p1, card, cardPlayPreview(t.p1, card))
        .facts.filter((f) => f.source.name === CardName.ADMINISTRATION_DISTRICT);
      const farming = new NoctisFarming();
      t.p1.cardsInHand.push(farming);
      const facts = forecastOf(farming);
      expect(facts).has.length(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].effects).deep.eq([{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}]);
      expect(facts[0].source.channel).eq('card-played');
      const combustors = new BiomassCombustors();
      t.p1.cardsInHand.push(combustors);
      expect(forecastOf(combustors)).is.empty;
      const before = t.p1.cardsInHand.length;
      t.p1.playCard(farming);
      runAllActions(t.game);
      expect(t.p1.cardsInHand.length - (before - 1)).eq(1);
    });
  });
});
