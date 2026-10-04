import {expect} from 'chai';
import {ReSettlement} from '../../../src/server/cards/turmoilRedux/ReSettlement';
import {AdministrationDistrict, NO_CITY_ON_MARS_REASON} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {
  MOVE_CITY_TILE_CONSTRAINT, MOVE_CITY_TILE_TITLE, NO_SPACE_TO_MOVE_A_CITY_REASON,
} from '../../../src/server/deferredActions/MoveCityTile';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {Space} from '../../../src/server/boards/Space';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {RoverConstruction} from '../../../src/server/cards/base/RoverConstruction';
import {Pets} from '../../../src/server/cards/base/Pets';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {TileType} from '../../../src/common/TileType';
import {AltSecondaryTag} from '../../../src/common/cards/render/AltSecondaryTag';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {aggregateByPlayer} from '../../../src/common/events/aggregate';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addOcean, runAllActions} from '../../TestingUtils';

/**
 * TR14 — RE-SETTLEMENT: the set's first card that MOVES a tile. Every rule
 * reading of the card file's header is pinned here at the PLAY; the mover, the
 * cell rule and the hypothesis have their own specs (tests/boards/cityMove,
 * cityMovePreview, tests/deferredActions/MoveCityTile).
 */
const M = PartyName.MARS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: ReSettlement};

function table(options?: {redux?: boolean}): Table {
  const [game, p1, p2] = testGame(2, options?.redux === true ? {turmoilReduxExpansion: true, coloniesExtension: true} : {});
  game.phase = Phase.ACTION;
  return {game, p1, p2, card: new ReSettlement()};
}

/** An interior land cell: six neighbours, every one plain empty land. */
function interiorLand(game: IGame, skip: ReadonlyArray<string> = []): Space {
  const board = game.board;
  const plain = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
  const found = board.spaces.find((space) => plain(space) && !skip.includes(space.id) &&
    board.getAdjacentSpaces(space).length === 6 && board.getAdjacentSpaces(space).every(plain));
  if (found === undefined) {
    throw new Error('no interior land cell');
  }
  return found;
}

function seatCity(t: Table, owner: TestPlayer, space: Space = interiorLand(t.game)): Space {
  t.game.simpleAddTile(owner, space, {tileType: TileType.CITY});
  return space;
}

/** Play the card for real (no requirement asked — `playCard` is past the gate) and return its move prompt. */
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

/** The same table with Mars First RULING — the requirement met, so only the move's own rule decides. */
function marsFirstRules(): Table {
  const t = parliamentTable();
  seatEnacted(t.game.parliament!, quietResolutionOf(M));
  return t;
}

function placementStepOf(player: TestPlayer, card: IProjectCard) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  return steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
}

const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

describe('ReSettlement', () => {
  it('registers with source-backed metadata (the scan: 7 · City, Building · green · Mars First · 1 VP)', () => {
    const card = new ReSettlement();
    expect(card.name).eq(CardName.RE_SETTLEMENT);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(7);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.CITY, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR14');
    expect(requiredPartyOf(card), 'the MIN plate holds the Mars First emblem').eq(M);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'the badge prints 1').eq(1);
    expect(card.resourceType).is.undefined;
    // The face, one row: «− [city with the «on Mars» corner] + [city]*».
    type Node = {is?: string, type?: string, secondaryTag?: string};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    expect(rows[0].map((n) => n.type ?? n.is)).deep.eq(['-', CardRenderItemType.CITY, '+', CardRenderItemType.CITY, '*']);
    expect(rows[0][1].secondaryTag, 'the city that LEAVES wears the set\'s «on Mars» hex').eq(AltSecondaryTag.MARS_TILE);
    expect(rows[0][3].secondaryTag, 'the city that lands is a plain city glyph').is.undefined;
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    function reduxTable(): Table {
      const t = parliamentTable();
      seatCity(t, t.p1);
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

  describe('rule 9 — unplayable: ONE named reason, the more fundamental first', () => {
    it('no city of one\'s own on Mars (another player\'s city, an off-Mars city of one\'s own do not help)', () => {
      const t = marsFirstRules();
      seatCity(t, t.p2);
      t.game.simpleAddTile(t.p1, t.game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY});
      expect(t.p1.canPlay(t.card)).is.false;
      expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'placement', message: NO_CITY_ON_MARS_REASON});
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_CITY_ON_MARS_REASON}]);
    });

    it('an own city with every neighbour taken: «none of your cities has a free adjacent space»', () => {
      const t = marsFirstRules();
      const own = seatCity(t, t.p1);
      t.game.board.getAdjacentSpaces(own).forEach((n) => t.game.simpleAddTile(t.p2, n, {tileType: TileType.GREENERY}));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_TO_MOVE_A_CITY_REASON}]);
    });

    it('rule 4-bis — the ONLY city stands over an ocean: reason №2 («nowhere to move»), never №1 («no city»)', () => {
      const t = marsFirstRules();
      const ocean = t.game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
        t.game.board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.LAND && n.tile === undefined))!;
      addOcean(t.p1, ocean.id);
      t.game.addTile(t.p1, ocean, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: ocean.tile});
      expect(t.game.board.getCitiesOnMars(t.p1), 'it IS their city on Mars').has.length(1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_TO_MOVE_A_CITY_REASON}]);
    });

    it('a city with a free cell beside it: playable, no reason', () => {
      const t = marsFirstRules();
      seatCity(t, t.p1);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(t.card.unplayableReason(t.p1)).is.undefined;
    });
  });

  describe('rules 2, 5, 10 — the question: the city AND the cell, one prompt, never auto-answered', () => {
    it('the play raises the shared move step: the marker, the address, the lifted rule in the title', () => {
      const t = table();
      const own = seatCity(t, t.p1);
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(MOVE_CITY_TILE_TITLE);
      expect(prompt.sourceCard, 'the staged tail\'s address').eq(CardName.RE_SETTLEMENT);
      expect(prompt.placementEffect).eq('move');
      expect(prompt.placementType).eq('city-move');
      expect(prompt.tileMove?.sources.map((s) => s.from.id)).deep.eq([own.id]);
      expect(ids(prompt.spaces)).to.have.members(ids(t.game.board.getAdjacentSpaces(own)));
      expect(own.tile?.tileType, 'nothing has moved — the city is lifted by the ANSWER').eq(TileType.CITY);
    });

    it('a single city with a single cell is still asked', () => {
      const t = table();
      const own = seatCity(t, t.p1);
      const [keep, ...rest] = t.game.board.getAdjacentSpaces(own);
      rest.forEach((n) => t.game.simpleAddTile(t.p2, n, {tileType: TileType.GREENERY}));
      const prompt = playToPrompt(t);
      expect(ids(prompt.spaces)).deep.eq([keep.id]);
      expect(own.tile?.tileType).eq(TileType.CITY);
      prompt.process({type: 'space', spaceId: keep.id, movedFrom: own.id});
      expect(keep.tile?.tileType).eq(TileType.CITY);
      expect(own.tile).is.undefined;
    });

    it('a city that cannot move is LISTED with its reason beside the one that can', () => {
      const t = table();
      const free = seatCity(t, t.p1);
      const locked = seatCity(t, t.p1, interiorLand(t.game, [free.id, ...ids(t.game.board.getAdjacentSpaces(free))]));
      t.game.board.getAdjacentSpaces(locked).forEach((n) => t.game.simpleAddTile(t.p2, n, {tileType: TileType.GREENERY}));
      const prompt = playToPrompt(t);
      expect(prompt.tileMove?.sources.map((s) => s.from.id)).deep.eq([free.id]);
      expect(prompt.tileMove?.disabledSources.map((e) => [e.space.id, e.reason])).deep.eq([[locked.id, 'no-space-to-move']]);
    });

    it('the staged preview is the SAME question as the live prompt (parity): title, cities, cells, reasons, tile, address', () => {
      const t = table();
      t.p1.megaCredits = 40;
      const first = seatCity(t, t.p1);
      seatCity(t, t.p1, interiorLand(t.game, [first.id, ...ids(t.game.board.getAdjacentSpaces(first))]));
      seatCity(t, t.p2, t.game.board.getAdjacentSpaces(first)[0]);
      const staged = placementStepOf(t.p1, t.card)?.staged;
      expect(staged, 'the play stages its move').is.not.undefined;
      const live = playToPrompt(t).toModel();
      expect(staged?.title).eq(live.title);
      expect(staged?.spaces).deep.eq(live.spaces);
      expect(staged?.illegalSpaces).deep.eq(live.illegalSpaces);
      expect(staged?.placementType).eq(live.placementType);
      expect(staged?.placementType).eq('city-move');
      expect(staged?.placementEffect).eq(live.placementEffect);
      expect(staged?.placementEffect).eq('move');
      expect(staged?.tileType).eq(live.tileType);
      expect(staged?.sourceCard).eq(live.sourceCard);
      expect(staged?.tileMove, 'which city reaches which cell — the same offer').deep.eq(live.tileMove);
      expect(staged?.tileMove?.sources).has.length(2);
    });

    it('the preview: the move names itself on the step — «move your city», never «place a city tile»', () => {
      const t = table();
      t.p1.megaCredits = 40;
      seatCity(t, t.p1);
      const step = placementStepOf(t.p1, t.card);
      expect(step?.placementType).eq('city-move');
      expect(step?.tileType).eq(TileType.CITY);
      expect(step?.constraint).eq(MOVE_CITY_TILE_CONSTRAINT);
    });
  });

  it('rule 3 — a stack: only the top tier leaves, and a plain city lands', () => {
    const t = table();
    const own = interiorLand(t.game);
    t.game.simpleAddTile(t.p1, own, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
    t.game.addCityTier(t.p1, own);
    const prompt = playToPrompt(t);
    const source = prompt.tileMove!.sources[0];
    expect(source.tiers).eq(2);
    expect(source.arrives).eq(TileType.CITY);
    prompt.process({type: 'space', spaceId: source.to[0].id, movedFrom: own.id});
    expect(own.tile?.tileType, 'the Capital underneath stays a Capital').eq(TileType.CAPITAL);
    expect('stackHeight' in own).is.false;
    expect(source.to[0].tile).deep.eq({tileType: TileType.CITY});
  });

  describe('rules 6–7 — the move is a PLACEMENT of a city tile on the new cell', () => {
    it('the cell\'s bonus, and every city trigger: Rover Construction, Pets, Martian Census, Tharsis Republic', () => {
      const t = table();
      const own = seatCity(t, t.p1);
      const to = t.game.board.getAdjacentSpaces(own)[0];
      to.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL];
      const pets = new Pets();
      const census = new MartianCensus();
      t.p1.playedCards.push(new RoverConstruction(), pets, census, new TharsisRepublic());
      const steel = t.p1.steel;
      const mc = t.p1.megaCredits;
      const production = t.p1.production.megacredits;
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: to.id, movedFrom: own.id});
      runAllActions(t.game);
      expect(to.tile?.tileType).eq(TileType.CITY);
      expect(to.player).eq(t.p1);
      expect(t.p1.steel - steel, 'the printed bonus').eq(2);
      expect(t.p1.megaCredits - mc, 'Rover Construction 2 + Tharsis Republic 3').eq(5);
      expect(t.p1.production.megacredits - production, 'Tharsis Republic: a city on Mars').eq(1);
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
      const own = seatCity(t, t.p1, board.getAdjacentSpaces(x).filter(free)[0]);
      const mc = t.p1.megaCredits;
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: x.id, movedFrom: own.id});
      runAllActions(t.game);
      expect(t.p1.megaCredits - mc).eq(2);
    });

    it('the ruling Mars First\'s passive answers the move: 1 steel for a tile on Mars, a card for a city', () => {
      const t = marsFirstRules();
      const own = seatCity(t, t.p1);
      const to = t.game.board.getAdjacentSpaces(own).find((s) => s.bonus.length === 0) ?? t.game.board.getAdjacentSpaces(own)[0];
      to.bonus = [];
      const steel = t.p1.steel;
      const hand = t.p1.cardsInHand.length;
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: to.id, movedFrom: own.id});
      runAllActions(t.game);
      expect(t.p1.steel - steel, 'Mars First: 1 steel').eq(1);
      expect(t.p1.cardsInHand.length - hand, 'Mars First: a card for a city').eq(1);
    });

    it('the forecast sees the city landing: another player\'s Rover Construction stands in «will fire»', () => {
      const t = table();
      t.p1.megaCredits = 40;
      seatCity(t, t.p1);
      t.p1.cardsInHand.push(t.card);
      t.p2.playedCards.push(new RoverConstruction());
      const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
        .filter((f) => f.source.name === CardName.ROVER_CONSTRUCTION);
      expect(facts).has.length(1);
      expect(facts[0].source.channel).eq('tile-placed');
    });
  });

  it('rule 8 — the number of cities does not change', () => {
    const t = table();
    const own = seatCity(t, t.p1);
    seatCity(t, t.p2, interiorLand(t.game, [own.id, ...ids(t.game.board.getAdjacentSpaces(own))]));
    const before = {mine: t.game.board.countCities(t.p1), all: t.game.board.countCities()};
    const prompt = playToPrompt(t);
    prompt.process({type: 'space', spaceId: prompt.tileMove!.sources[0].to[0].id, movedFrom: own.id});
    runAllActions(t.game);
    expect({mine: t.game.board.countCities(t.p1), all: t.game.board.countCities()}).deep.eq(before);
  });

  it('rule 12 — ONE `tile-moved` event under the card\'s own play, one log line, and «tiles placed» does not grow', () => {
    const t = marsFirstRules();
    const own = seatCity(t, t.p1);
    const placedBefore = aggregateByPlayer(t.game.events.events).get(t.p1.color)?.tilesPlaced ?? 0;
    const to = t.game.board.getAdjacentSpaces(own)[0];
    const logBefore = t.game.gameLog.length;

    t.p1.playCard(t.card);
    runAllActions(t.game);
    // Answered through the player's own door, so the event rides the scope the play opened.
    cast(t.p1.getWaitingFor(), SelectSpace);
    t.p1.process({type: 'space', spaceId: to.id, movedFrom: own.id});
    runAllActions(t.game);

    const moved = t.game.events.events.filter((e) => e.type === 'tile-moved');
    expect(moved).has.length(1);
    expect(moved[0].impact.tileMove).deep.eq({from: own.id, to: to.id, tileType: TileType.CITY});
    expect(moved[0].player).eq(t.p1.color);
    expect(moved[0].source, 'attributed to the card whose effect it was').deep.include({kind: 'card', card: CardName.RE_SETTLEMENT});
    expect(aggregateByPlayer(t.game.events.events).get(t.p1.color)?.tilesPlaced ?? 0).eq(placedBefore);
    expect(t.game.gameLog.slice(logBefore).filter((l) => l.message === '${0} moved their city · ${1} → ${2}')).has.length(1);

    // THE JOURNAL draws it as a row of its own — the tile and the cell it came to, named a relocation, never a placement.
    const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.RE_SETTLEMENT);
    expect(root, 'the scope the play opened').is.not.undefined;
    const rows = buildEventChildren(t.game.events.events.filter((e) => e.correlationId === root!.id), root!.id, t.p1.color);
    const row = rows.find((r) => r.source.kind === 'label' && r.source.label === 'Tile relocation');
    expect(row, `the journal's rows: ${rows.map((r) => JSON.stringify(r.source)).join(' ')}`).is.not.undefined;
    expect(row).deep.include({bucket: 'placement', space: to.id, tileLabel: 'city'});
    expect(rows.some((r) => r.source.kind === 'label' && r.source.label === 'Placement'), 'no «Placement» row — nothing was placed').is.false;
  });

  it('rule 13 — with TR16 in the tableau the play draws a card (a Building card with 1 VP), and the forecast says so first', () => {
    const t = table();
    t.p1.playedCards.push(new AdministrationDistrict());
    t.p1.megaCredits = 40;
    const own = seatCity(t, t.p1);
    t.p1.cardsInHand.push(t.card);
    const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
      .filter((f) => f.source.name === CardName.ADMINISTRATION_DISTRICT);
    expect(facts).has.length(1);
    expect(facts[0].certainty).eq('exact');
    expect(facts[0].effects).deep.eq([{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}]);
    const before = t.p1.cardsInHand.length;
    const prompt = playToPrompt(t);
    const to = t.game.board.getAdjacentSpaces(own).find((s) => !s.bonus.includes(SpaceBonus.DRAW_CARD))!;
    prompt.process({type: 'space', spaceId: to.id, movedFrom: own.id});
    runAllActions(t.game);
    expect(t.p1.cardsInHand.length - (before - 1), 'exactly the forecast\'s card').eq(1);
    expect(t.p1.cardDrawReveals.at(-1)?.source).deep.eq({type: 'card', cardName: CardName.ADMINISTRATION_DISTRICT});
  });

  it('survives a save and a load: the played card stays played, the city stays moved', () => {
    const t = table();
    const own = seatCity(t, t.p1);
    const prompt = playToPrompt(t);
    const to = prompt.tileMove!.sources[0].to[0];
    prompt.process({type: 'space', spaceId: to.id, movedFrom: own.id});
    runAllActions(t.game);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const player = live.getPlayerById(t.p1.id);
    expect(player.playedCards.asArray().map((c) => c.name)).to.include(CardName.RE_SETTLEMENT);
    expect(live.board.getSpaceOrThrow(to.id).tile?.tileType).eq(TileType.CITY);
    expect(live.board.getSpaceOrThrow(own.id).tile).is.undefined;
    expect(live.board.countCities(player)).eq(1);
  });
});
