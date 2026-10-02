import {expect} from 'chai';
import {
  NO_SPACE_FOR_CITY_REASON, SPONSORED_SETTLEMENT_TITLE, SponsoredSettlement,
} from '../../../src/server/cards/turmoilRedux/SponsoredSettlement';
import {AdministrationDistrict} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {cityIgnoringRestrictions} from '../../../src/server/boards/ignoreRestrictionsCity';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Space} from '../../../src/server/boards/Space';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
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
import {addCity, addOcean, runAllActions} from '../../TestingUtils';
import {CityNeighbourhood, cityNeighbourhood} from '../../boards/cityNeighbourhood';

/**
 * TR19 — SPONSORED SETTLEMENT: TR16 Administration District's younger sister —
 * the same city «IGNORING OTHER PLACEMENT RESTRICTIONS» without the adjacency,
 * after a +2 M€ production step. Every rule reading of the card file's header
 * is pinned here; the cell rule itself (both branches) has its own spec
 * (tests/boards/ignoreRestrictionsCity.spec.ts).
 */
const M = PartyName.MARS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: SponsoredSettlement};

function table(options?: {redux?: boolean}): Table {
  const [game, p1, p2] = testGame(2, options?.redux === true ? {turmoilReduxExpansion: true, coloniesExtension: true} : {});
  game.phase = Phase.ACTION;
  return {game, p1, p2, card: new SponsoredSettlement()};
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

function stagedOf(player: TestPlayer, card: SponsoredSettlement) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  const placement = steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
  return placement?.staged;
}

describe('SponsoredSettlement', () => {
  it('registers with source-backed metadata (the scan: 16 · City, Building · green · Mars First · 1 VP)', () => {
    const card = new SponsoredSettlement();
    expect(card.name).eq(CardName.SPONSORED_SETTLEMENT);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(16);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.CITY, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR19');
    expect(requiredPartyOf(card), 'the MIN plate holds the Mars First emblem').eq(M);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'the VP badge on the Mars disc').eq(1);
    expect(card.behavior?.production).deep.eq({megacredits: 2});
    expect(card.resourceType).is.undefined;
    // The face: one play row «[production: 2 M€] [city]*».
    type Node = {is?: string, type?: string};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    expect(rows[0].map((n) => n.type ?? n.is)).deep.eq(['production-box', CardRenderItemType.NBSP, CardRenderItemType.CITY, '*']);
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Mars First rules: playable — no city of one\'s own is needed (the sister\'s adjacency is not this card\'s)', () => {
      const t = parliamentTable();
      seatEnacted(t.game.parliament!, quietResolutionOf(M));
      expect(t.game.board.getCitiesOnMars(t.p1)).is.empty;
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = parliamentTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      parliament.placeVote(t.p1, parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  it('rule 2 — +2 M€ production, raised BEFORE the city is asked for', () => {
    const t = table();
    expect(t.p1.production.megacredits).eq(0);
    const prompt = playToPrompt(t);
    expect(t.p1.production.megacredits, 'the production step is already made under the open prompt').eq(2);
    prompt.cb(prompt.spaces[0]);
    runAllActions(t.game);
    expect(t.p1.production.megacredits).eq(2);
  });

  describe('rule 3 — the cells: ANY non-reserved land, the city rule lifted, the reservations kept', () => {
    it('beside one\'s own city — yes; beside another player\'s only — yes; beside both — yes; far from cities — yes', () => {
      const t = table();
      const {own, shared, foreign, foreignOnly} = arranged(t);
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(SPONSORED_SETTLEMENT_TITLE);
      expect(prompt.sourceCard, 'the staged tail\'s address').eq(CardName.SPONSORED_SETTLEMENT);
      const legal = prompt.spaces.map((s) => s.id);
      const nearCity = (s: Space) => t.game.board.getAdjacentSpaces(s).some((n) => n.id === own.id || n.id === foreign.id);
      const far = t.game.board.getAvailableSpacesOnLand(t.p1).find((s) => !nearCity(s));
      expect(far).is.not.undefined;
      expect(legal).to.include.members([shared.id, foreignOnly.id, far!.id]);
      expect(legal, 'the city cells themselves are occupied').to.not.include.members([own.id, foreign.id]);
      expect(legal, 'the engine\'s whole land set').to.have.members(t.game.board.getAvailableSpacesOnLand(t.p1).map((s) => s.id));
      // The ordinary city rule would refuse both cells beside a city.
      const ordinary = t.game.board.getAvailableSpacesForCity(t.p1).map((s) => s.id);
      expect(ordinary).to.not.include.members([shared.id, foreignOnly.id]);
      expect(prompt.illegalSpaces?.map((e) => e.reason), 'the lifted rule is never quoted').to.not.include('adjacent-to-city');
    });

    it('an ocean cell, Noctis, an occupied cell, another player\'s claim and the Nomads camp stay out, each with the generic reason', () => {
      const t = table();
      const board = t.game.board;
      const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
      const noctis = board.getSpaceOrThrow(SpaceName.NOCTIS_CITY);
      const ocean = board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      const [occupied, claimed, ownClaim, camp] = board.spaces.filter(free);
      occupied.tile = {tileType: TileType.GREENERY};
      claimed.player = t.p2;
      ownClaim.player = t.p1;
      t.game.nomadSpace = camp.id;
      const prompt = playToPrompt(t);
      const legal = prompt.spaces.map((s) => s.id);
      const reasonOf = (space: Space) => prompt.illegalSpaces?.find((e) => e.spaceId === space.id)?.reason;
      expect(legal).to.not.include.members([noctis.id, ocean.id, occupied.id, claimed.id, camp.id]);
      expect(legal, 'one\'s own claim is one\'s own cell').to.include(ownClaim.id);
      expect(reasonOf(noctis)).eq('reserved-noctis');
      expect(reasonOf(ocean)).eq('ocean-only');
      expect(reasonOf(occupied)).eq('occupied');
      expect(reasonOf(claimed)).eq('owned-by-other');
      expect(reasonOf(camp), 'the camp keeps a generic reason too').is.not.undefined;
    });

    it('the staged preview offers the SAME cells and the SAME reasons as the live prompt (parity)', () => {
      const t = table();
      t.p1.megaCredits = 40;
      arranged(t);
      const staged = stagedOf(t.p1, t.card);
      expect(staged, 'the play stages its city').is.not.undefined;
      expect(staged?.title).eq(SPONSORED_SETTLEMENT_TITLE);
      expect(staged?.placementType).eq('city');
      expect(staged?.sourceCard).eq(CardName.SPONSORED_SETTLEMENT);
      const prompt = playToPrompt(t);
      expect(staged?.spaces).to.have.members(prompt.spaces.map((s) => s.id));
      expect(staged?.illegalSpaces).deep.eq(prompt.illegalSpaces);
      expect(staged?.tileType).eq(prompt.tileType);
    });

    it('the preview: the production chip from `behavior`, then the city door naming the lifted rule', () => {
      const t = table();
      t.p1.megaCredits = 40;
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      const production = branch.effects.find((e) => e.note === 'production');
      expect(production).deep.include({direction: 'gain', icon: 'megacredits', amount: 2, current: 0, resulting: 2});
      const placement = branch.steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
      expect(placement?.tileType).eq(TileType.CITY);
      expect(placement?.constraint).eq('on a non-reserved space, ignoring other placement restrictions');
    });

    it('the placement gives what an ordinary city gives: the cell\'s bonus and every city trigger', () => {
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
      const x = board.getAvailableSpacesOnLand(t.p1).filter((s) => s.bonus.length === 0 &&
        board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.OCEAN))[0];
      addOcean(t.p2, board.getAdjacentSpaces(x).filter((n) => n.spaceType === SpaceType.OCEAN)[0].id);
      const mc = t.p1.megaCredits;
      const prompt = playToPrompt(t);
      prompt.cb(prompt.spaces.find((s) => s.id === x.id)!);
      runAllActions(t.game);
      expect(t.p1.megaCredits - mc).eq(2);
    });
  });

  describe('rule 4 — no legal cell at all: ONE named reason', () => {
    it('every land cell taken: unplayable with «No space left for a city tile»', () => {
      const t = marsFirstRules();
      for (const space of t.game.board.getAvailableSpacesOnLand(t.p1)) {
        space.tile = {tileType: TileType.GREENERY};
      }
      expect(cityIgnoringRestrictions(t.p1, {})).is.empty;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'placement', message: NO_SPACE_FOR_CITY_REASON});
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_FOR_CITY_REASON}]);
    });

    it('one free cell, beside another player\'s city: playable, no reason', () => {
      const t = marsFirstRules();
      const {foreignOnly} = arranged(t);
      for (const space of t.game.board.getAvailableSpacesOnLand(t.p1)) {
        if (space.id !== foreignOnly.id) {
          space.tile = {tileType: TileType.GREENERY};
        }
      }
      expect(t.p1.canPlay(t.card)).is.true;
      expect(t.card.unplayableReason(t.p1)).is.undefined;
    });
  });

  it('rule 5 — with TR16 in the tableau the play draws a card (a Building card with 1 VP), and the forecast says so first', () => {
    const t = table();
    t.p1.playedCards.push(new AdministrationDistrict());
    t.p1.megaCredits = 40;
    t.p1.cardsInHand.push(t.card);
    const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
      .filter((f) => f.source.name === CardName.ADMINISTRATION_DISTRICT);
    expect(facts).has.length(1);
    expect(facts[0].certainty).eq('exact');
    expect(facts[0].effects).deep.eq([{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}]);
    expect(facts[0].source.channel).eq('card-played');
    const before = t.p1.cardsInHand.length;
    const prompt = playToPrompt(t);
    prompt.cb(prompt.spaces.find((s) => !s.bonus.includes(SpaceBonus.DRAW_CARD))!);
    runAllActions(t.game);
    expect(t.p1.cardsInHand.length - (before - 1), 'exactly the forecast\'s card').eq(1);
    expect(t.p1.cardDrawReveals.at(-1)?.source).deep.eq({type: 'card', cardName: CardName.ADMINISTRATION_DISTRICT});
  });
});
