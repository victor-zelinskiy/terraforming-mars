import {expect} from 'chai';
import {NovaCity} from '../../../src/server/cards/turmoilRedux/NovaCity';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {TileType} from '../../../src/common/TileType';
import {Resource} from '../../../src/common/Resource';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay, tilesOfPlay} from '../../../src/server/models/effectForecast';
import {calculateVictoryPoints, cardVictoryPointsAtPlay} from '../../../src/server/game/calculateVictoryPoints';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {
  CITY_ALREADY_ON_COLONY_TILE_REASON,
  COLONY_TILE_HAS_TILE_REASON,
  ColoniesHandler,
  NO_COLONY_TILE_IN_PLAY_REASON,
} from '../../../src/server/colonies/ColoniesHandler';
import {CITY_ON_COLONY_TILE_LABEL, PLACE_CITY_ON_COLONY_TILE_TITLE} from '../../../src/server/deferredActions/PlaceCityOnColonyTile';
import {Luna} from '../../../src/server/colonies/Luna';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Titan} from '../../../src/server/colonies/Titan';
import {Pets} from '../../../src/server/cards/base/Pets';
import {ImmigrantCity} from '../../../src/server/cards/base/ImmigrantCity';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {COLONIZATION_FUNDING_ID} from '../../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {
  answerQuestGate, endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution,
} from '../../parliament/parliamentArrange';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';

/**
 * TR22 — NOVA CITY: the set's first city placed ON A COLONY TILE. Every rule
 * reading of the card file's header is pinned here at the PLAY; the writer,
 * the hosted cell and the save / load have their own spec
 * (tests/colonies/ColonyCity), the shared step its own
 * (tests/deferredActions/PlaceCityOnColonyTile).
 */
const U = PartyName.UNITY;
const NOVA = CardName.NOVA_CITY;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: NovaCity, luna: Luna, ceres: Ceres, titan: Titan};

function table(options: {venus?: boolean} = {}): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: options.venus === true});
  game.phase = Phase.ACTION;
  const luna = new Luna();
  const ceres = new Ceres();
  const titan = new Titan();
  titan.isActive = false;
  game.colonies = [ceres, luna, titan];
  p1.megaCredits = 40;
  return {game, p1, p2, card: new NovaCity(), luna, ceres, titan};
}

/** Three QUIET real resolutions in the voting area: Greens · Unity · Industrialists. */
function parliamentTable(): Table {
  const t = table();
  const parliament = t.game.parliament!;
  ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return t;
}

/** The same table with Unity RULING — the requirement met, so only the card's own rule decides. */
function unityRules(): Table {
  const t = parliamentTable();
  seatEnacted(t.game.parliament!, quietResolutionOf(U));
  return t;
}

/** Play the card for real (`playCard` is past the requirement's gate) and return its colony prompt. */
function playToPrompt(t: Table): SelectColony {
  t.p1.playCard(t.card);
  runAllActions(t.game);
  return cast(t.p1.popWaitingFor(), SelectColony);
}

function playOn(t: Table, colony = t.luna): void {
  playToPrompt(t).cb(colony);
  runAllActions(t.game);
}

/** …the same play under an ACTION scope (what a real turn opens) — the quest and the triggers' attribution need it. */
function playAsAction(t: Table, colony = t.luna): void {
  const events = t.game.events;
  events.beginAction(t.p1, {kind: 'card', card: NOVA, owner: t.p1.color}, {category: 'card-play'});
  try {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    cast(t.p1.popWaitingFor(), SelectColony).cb(colony);
    runAllActions(t.game);
  } finally {
    events.endScope();
  }
}

function seatSpaceCity(t: Table, owner: TestPlayer, id: string, card: CardName): void {
  t.game.simpleAddTile(owner, t.game.board.getSpaceOrThrow(id as typeof SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY, card});
}

function colonyPickOf(player: TestPlayer, card: IProjectCard) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  return steps.find((s): s is Extract<ActionPreviewStep, {kind: 'colonyPick'}> => s.kind === 'colonyPick');
}

describe('NovaCity', () => {
  it('registers with source-backed metadata (the scan: 18 · Jovian, City, Space · green · Unity · «2 / space city»)', () => {
    const card = new NovaCity();
    expect(card.name).eq(NOVA);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(18);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.JOVIAN, Tag.CITY, Tag.SPACE]);
    expect(card.metadata.cardNumber).eq('TR22');
    expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, '`all: false` is load-bearing — the player\'s OWN cities').deep.eq({cities: {where: 'offmars'}, all: false, each: 2});
    expect(card.resourceType).is.undefined;
    // The face, one row: «[city]*» — a PLAIN city, no corner bubble.
    type Node = {is?: string, type?: string, secondaryTag?: string};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    expect(rows[0].map((n) => n.type ?? n.is)).deep.eq([CardRenderItemType.CITY, '*']);
    expect(rows[0][0].secondaryTag).is.undefined;
    // The badge: «2 / [city with the round SPACE bubble]» — the existing secondary tag, no new glyph.
    const badge = card.metadata.victoryPoints as {points: number, target: number, item: {type: string, secondaryTag?: string, anyPlayer?: boolean}};
    expect(badge.points).eq(2);
    expect(badge.target).eq(1);
    expect(badge.item.type).eq(CardRenderItemType.CITY);
    expect(badge.item.secondaryTag).eq(Tag.SPACE);
    expect(badge.item.anyPlayer, 'the player\'s own — no red border').is.false;
  });

  it('is in the Turmoil Redux manifest and needs Colonies (the grey ▲)', () => {
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = manifest.projectCards[NOVA]!;
    expect(new entry.Factory().name).eq(NOVA);
    expect(entry.compatibility).eq('colonies');
  });

  describe('rule 1 — the requirement: Unity rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason — Unity\'s', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Unity rules: playable', () => {
      const t = unityRules();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = parliamentTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card), 'one delegate is not two').is.false;
      parliament.placeVote(t.p1, parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rule 2 — «a colony tile in play»: any tile of the table, the reserve never', () => {
    it('anybody\'s, with colonies or without, with a docked fleet, active or INACTIVE — in the table\'s order', () => {
      const t = table();
      t.ceres.colonies.push(t.p2.id, t.p2.id, t.p1.id);
      t.luna.visitor = t.p2.id;
      t.game.discardedColonies.push(new Luna());
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(PLACE_CITY_ON_COLONY_TILE_TITLE);
      expect(prompt.colonies).deep.eq([t.ceres, t.luna, t.titan]);
      expect(prompt.disabledColonies).deep.eq([]);
    });

    it('rule 9 — a SINGLE tile in play is still chosen by a press', () => {
      const t = table();
      t.game.colonies = [t.titan];
      const prompt = playToPrompt(t);
      expect(prompt.colonies).deep.eq([t.titan]);
      expect(t.game.board.getSpaceOrThrow(SpaceName.NOVA_CITY).tile, 'nothing lands before the answer').is.undefined;
      prompt.cb(t.titan);
      expect(t.titan.tiles).deep.eq([SpaceName.NOVA_CITY]);
    });
  });

  describe('rule 3 — a REAL city tile of the player\'s, off Mars', () => {
    it('the tile, its owner, its card — counted «everywhere» and «off Mars», never «on Mars»', () => {
      const t = table();
      playOn(t);
      const cell = t.game.board.getSpaceOrThrow(SpaceName.NOVA_CITY);
      expect(cell.tile).deep.eq({tileType: TileType.CITY, card: NOVA});
      expect(cell.player).eq(t.p1);
      expect(t.luna.tiles).deep.eq([SpaceName.NOVA_CITY]);
      expect(t.game.board.getCities(t.p1)).deep.eq([cell]);
      expect(t.game.board.getCitiesOffMars(t.p1)).deep.eq([cell]);
      expect(t.game.board.getCitiesOnMars(t.p1)).deep.eq([]);
      expect(t.p1.game.board.getCities().length, 'Mayor / Metropolist / the cities requirement read this list').eq(1);
    });
  });

  describe('rule 4 — it IS a placement of a city tile (the engine\'s `addTile`, nothing programmed here)', () => {
    it('Pets answers: +1 animal', () => {
      const t = table();
      const pets = new Pets();
      t.p1.playedCards.push(pets);
      playOn(t);
      expect(pets.resourceCount).eq(1);
    });

    it('Immigrant City answers: +1 M€ production', () => {
      const t = table();
      t.p1.playedCards.push(new ImmigrantCity());
      const production = t.p1.production.megacredits;
      playOn(t);
      expect(t.p1.production.megacredits).eq(production + 1);
    });

    it('Tharsis Republic: 3 M€ for the player\'s own city — but NO production step (off Mars)', () => {
      const t = table();
      t.p1.playedCards.push(new TharsisRepublic());
      const production = t.p1.production.megacredits;
      const megaCredits = t.p1.megaCredits;
      playOn(t);
      expect(t.p1.megaCredits).eq(megaCredits + 3);
      expect(t.p1.production.megacredits).eq(production);
    });

    it('the ruling Mars First\'s passive does NOT answer: no steel, no card (a city off Mars)', () => {
      const t = parliamentTable();
      seatResolution(t.game.parliament!, 1, quietResolutionOf(PartyName.MARS));
      seatEnacted(t.game.parliament!, quietResolutionOf(PartyName.MARS));
      const steel = t.p1.stock.get(Resource.STEEL);
      playAsAction(t);
      expect(t.p1.stock.get(Resource.STEEL)).eq(steel);
      expect(t.p1.cardsInHand).has.length(0);
    });

    it('RX08 Colonization Funding\'s quest «place 1 space city» is completed by it', () => {
      const t = table();
      const parliament = t.game.parliament!;
      seatResolution(parliament, 0, COLONIZATION_FUNDING_ID);
      parliament.placeVote(t.p1, parliament.slots[0], 'lobby');
      t.p2.megaCredits = 20;
      endGenerationThroughParliament(t.game);
      runAllActions(t.game);
      t.game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(COLONIZATION_FUNDING_ID);
      expect(parliament.questProgressOf(t.p1)).eq(0);
      playAsAction(t);
      expect(parliament.quest?.completedBy).eq(t.p1.id);
      answerQuestGate(t.game, t.p1);
      expect(parliament.chairman).eq(t.p1.id);
    });
  });

  describe('rule 5 — no placement bonus, and NOT a colony', () => {
    it('nothing is gained from the cell; colonies, berths, track, fleet and trade stand as they were', () => {
      const t = table();
      t.luna.colonies.push(t.p2.id);
      t.luna.trackPosition = 4;
      const colonies = t.p1.getColoniesCount();
      const production = JSON.stringify(t.p1.production.asUnits());
      t.p1.megaCredits = 0;
      const stockUnpaid = JSON.stringify(t.p1.stock.asUnits());
      playOn(t);
      expect(JSON.stringify(t.p1.stock.asUnits()), 'no bonus of any kind').eq(stockUnpaid);
      expect(JSON.stringify(t.p1.production.asUnits())).eq(production);
      expect(t.p1.getColoniesCount()).eq(colonies);
      expect(t.luna.colonies).deep.eq([t.p2.id]);
      expect(t.luna.trackPosition).eq(4);
      expect(t.luna.visitor).is.undefined;
      expect(t.p1.colonies.usedTradeFleets).eq(0);
    });
  });

  describe('rule 6 — a tile carrying the city cannot leave the game (TR10\'s «TILES» clause)', () => {
    it('the one predicate names it', () => {
      const t = table();
      playOn(t);
      expect(ColoniesHandler.colonyTileOccupiedReason(t.luna)).eq(COLONY_TILE_HAS_TILE_REASON);
      expect(ColoniesHandler.colonyTileIsVacant(t.ceres)).is.true;
    });
  });

  describe('rule 7 — 2 VP per space city of the player\'s OWN', () => {
    function row(t: Table) {
      return calculateVictoryPoints(t.p1).detailsCards.find((d) => d.cardName === NOVA);
    }

    it('alone: 2 — this city counts', () => {
      const t = table();
      playOn(t);
      expect(t.card.getVictoryPoints(t.p1)).eq(2);
      expect(row(t)).deep.eq({
        cardName: NOVA, victoryPoint: 2, kind: 'conditional',
        mechanics: {shape: 'per', each: 2, per: 1, counted: 1, unit: 'cities', where: 'offmars', countedSpaces: [SpaceName.NOVA_CITY]},
      });
    });

    it('with Ganymede Colony: 4; with a city of Venus too: 6 (the FAQ — any city that is not on Mars)', () => {
      const t = table({venus: true});
      playOn(t);
      seatSpaceCity(t, t.p1, SpaceName.GANYMEDE_COLONY, CardName.GANYMEDE_COLONY);
      expect(t.card.getVictoryPoints(t.p1)).eq(4);
      seatSpaceCity(t, t.p1, SpaceName.MAXWELL_BASE, CardName.MAXWELL_BASE);
      expect(t.card.getVictoryPoints(t.p1)).eq(6);
      expect(row(t)?.mechanics?.counted).eq(3);
      expect(row(t)?.mechanics?.countedSpaces, 'the very cells, in the board\'s order').deep.eq([
        SpaceName.GANYMEDE_COLONY, SpaceName.MAXWELL_BASE, SpaceName.NOVA_CITY,
      ]);
    });

    it('a rival\'s space city does not count; a city on Mars does not count', () => {
      const t = table();
      playOn(t);
      seatSpaceCity(t, t.p2, SpaceName.PHOBOS_SPACE_HAVEN, CardName.PHOBOS_SPACE_HAVEN);
      t.game.simpleAddTile(t.p1, t.game.board.getAvailableSpacesOnLand(t.p1)[0], {tileType: TileType.CITY});
      expect(t.card.getVictoryPoints(t.p1)).eq(2);
      expect(row(t)?.mechanics).to.not.have.property('all');
    });
  });

  describe('rule 8 — unplayable: ONE named reason, in order', () => {
    it('the requirement comes first; the hook of the card then names ONE blocker of its own', () => {
      const t = parliamentTable();
      ColoniesHandler.placeCityOnColonyTile(t.game, t.p2, t.ceres, {card: NOVA});
      t.game.colonies = [];
      // The hand's popover lists every CLASS of blocker (the printed requirement, then the situation);
      // of its own two the card names the more fundamental only — the taken cell, never «no tile» beside it.
      expect(unplayableReasons(t.p1, t.card).map((r) => [r.type, r.message])).deep.eq([
        ['party', PARTY_REQUIREMENT_REASON],
        ['placement', CITY_ALREADY_ON_COLONY_TILE_REASON],
      ]);
    });

    it('the city\'s own cell is taken (a second copy of the card): named', () => {
      const t = unityRules();
      ColoniesHandler.placeCityOnColonyTile(t.game, t.p2, t.ceres, {card: NOVA});
      expect(t.p1.canPlay(t.card)).is.false;
      expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'placement', message: CITY_ALREADY_ON_COLONY_TILE_REASON});
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: CITY_ALREADY_ON_COLONY_TILE_REASON}]);
    });

    it('no colony tile in play: named', () => {
      const t = unityRules();
      t.game.colonies = [];
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_COLONY_TILE_IN_PLAY_REASON}]);
    });
  });

  describe('rule 10 — the journal and the event', () => {
    it('the placement\'s own sentence, and `tile-placed` naming the colony tile under the card', () => {
      const t = table();
      const before = t.game.gameLog.length;
      playAsAction(t, t.titan);
      const lines = t.game.gameLog.slice(before).map((line) => line.message);
      expect(lines).to.include('${0} placed a city on the ${1} colony tile');
      const placed = t.game.events.events.filter((e) => e.type === 'tile-placed');
      expect(placed).has.length(1);
      expect(placed[0].player).eq(t.p1.color);
      expect(placed[0].space).eq(SpaceName.NOVA_CITY);
      expect(placed[0].impact).deep.eq({tilesPlaced: 1, colonyTile: ColonyName.TITAN});
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).deep.eq([]);
    });
  });

  describe('rule 12 — save / load', () => {
    it('the played card, its city and its score survive a round trip', () => {
      const t = table();
      playOn(t);
      seatSpaceCity(t, t.p1, SpaceName.GANYMEDE_COLONY, CardName.GANYMEDE_COLONY);
      const loaded = Game.deserialize(t.game.serialize());
      const p1 = loaded.players.find((p) => p.id === t.p1.id)!;
      const card = p1.tableau.get(NOVA)!;
      expect(card.getVictoryPoints(p1)).eq(4);
      expect(loaded.colonies.find((c) => c.name === ColonyName.LUNA)!.tiles).deep.eq([SpaceName.NOVA_CITY]);
    });

    it('a save made before the card existed (no cell 79) is playable after the load', () => {
      const t = unityRules();
      const serialized = t.game.serialize();
      serialized.board.spaces = serialized.board.spaces.filter((space) => space.id !== SpaceName.NOVA_CITY);
      const loaded = Game.deserialize(serialized);
      const p1 = loaded.players.find((p) => p.id === t.p1.id)!;
      const card = new NovaCity();
      expect(p1.canPlay(card)).is.true;
      p1.playCard(card);
      runAllActions(loaded);
      const prompt = cast(p1.getWaitingFor(), SelectColony);
      prompt.cb(prompt.colonies[0]);
      expect(loaded.board.getCitiesOffMars(p1).map((space) => space.id)).deep.eq([SpaceName.NOVA_CITY]);
    });
  });

  describe('the play preview — the staged colony door, the forecast\'s tile, the VP projection', () => {
    it('one branch with the DOOR: the very prompt the commit asks, addressed by the card, with the `tileSite` marker', () => {
      const t = table();
      const step = colonyPickOf(t.p1, t.card)!;
      expect(step.staged.sourceCard).eq(NOVA);
      expect(step.staged.prompt.choiceContext?.source).deep.eq({kind: 'card', card: NOVA});
      expect(step.staged.prompt.coloniesModel.map((c) => c.name)).deep.eq([ColonyName.CERES, ColonyName.LUNA, ColonyName.TITAN]);
      expect(step.staged.prompt.tileSite).deep.eq({
        tile: TileType.CITY, space: SpaceName.NOVA_CITY, color: t.p1.color, card: NOVA,
        spaceCities: {before: 0, after: 1}, victoryPoints: 2,
      });
      // The live prompt is that prompt.
      const live = playToPrompt(t).toModel(t.p1);
      expect(step.staged.prompt.tileSite).deep.eq(live.tileSite);
      expect(step.staged.prompt.coloniesModel).deep.eq(live.coloniesModel);
    });

    it('no tile in play — no door, the NAMED warning (the card is unplayable there anyway)', () => {
      const t = table();
      t.game.colonies = [];
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.find((s) => s.kind === 'colonyPick')).is.undefined;
      expect(steps[0]).deep.include({kind: 'note', noteKind: 'warning', text: NO_COLONY_TILE_IN_PLAY_REASON});
      expect((steps[0] as {skipped?: unknown}).skipped).deep.eq({label: CITY_ON_COLONY_TILE_LABEL});
    });

    it('the forecast reads the tile off the door: ONE city, off Mars, on the hosted cell', () => {
      const t = table();
      const preview = cardPlayPreview(t.p1, t.card);
      expect(tilesOfPlay(t.p1, t.card, preview)).deep.eq([{
        tileType: TileType.CITY, count: 1, countsAsCity: true, countsAsOcean: false, countsAsGreenery: false,
        placementType: 'city', offMars: true, space: SpaceName.NOVA_CITY,
      }]);
    });

    it('«⚡ will fire»: Pets is promised, the ruling Mars First\'s passive is not', () => {
      const t = parliamentTable();
      seatResolution(t.game.parliament!, 1, quietResolutionOf(PartyName.MARS));
      seatEnacted(t.game.parliament!, quietResolutionOf(PartyName.MARS));
      t.p1.playedCards.push(new Pets());
      const forecast = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card));
      const sources = JSON.stringify(forecast.facts);
      expect(sources).to.include(CardName.PETS);
      expect(sources, 'no steel and no card from Mars First for a city off Mars').to.not.include(PartyName.MARS);
    });

    it('the VP projection: «+2 now» alone, «+4» beside Ganymede — the score row after the play, byte for byte', () => {
      const t = table();
      seatSpaceCity(t, t.p1, SpaceName.GANYMEDE_COLONY, CardName.GANYMEDE_COLONY);
      const projected = cardVictoryPointsAtPlay(t.p1, t.card, tilesOfPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)));
      expect(projected).deep.eq({
        cardName: NOVA, victoryPoint: 4, kind: 'conditional',
        mechanics: {
          shape: 'per', each: 2, per: 1, counted: 2, unit: 'cities', where: 'offmars',
          countedSpaces: [SpaceName.GANYMEDE_COLONY, SpaceName.NOVA_CITY],
        },
      });
      playOn(t);
      expect(calculateVictoryPoints(t.p1).detailsCards.find((d) => d.cardName === NOVA)).deep.eq(projected);
    });

    it('READ-ONLY: the preview, the forecast and the projection mutate nothing', () => {
      const t = table();
      t.p1.playedCards.push(new Pets());
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      effectForecastForPlay(t.p1, t.card, preview);
      cardVictoryPointsAtPlay(t.p1, t.card, tilesOfPlay(t.p1, t.card, preview));
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.deferredActions.length).eq(0);
    });
  });
});
