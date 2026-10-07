import {expect} from 'chai';
import {RED_MUSEUM_DATA_PER_TILE, RedMuseum, museumBlockers} from '../../../src/server/cards/turmoilRedux/RedMuseum';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {IPlayer} from '../../../src/server/IPlayer';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Space} from '../../../src/server/boards/Space';
import {BoardType} from '../../../src/server/boards/BoardType';
import {boardCellPreview} from '../../../src/server/boards/BoardInformationEngine';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ImmigrantCity} from '../../../src/server/cards/base/ImmigrantCity';
import {GanymedeColony} from '../../../src/server/cards/base/GanymedeColony';
import {NuclearZone} from '../../../src/server/cards/base/NuclearZone';
import {Mangrove} from '../../../src/server/cards/base/Mangrove';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {TileType} from '../../../src/common/TileType';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {BoardFact, BoardPlacementKind} from '../../../src/common/boards/BoardInformationFacts';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, addGreenery, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR30 — RED MUSEUM: the set's first card under the Reds' plate, and its first
 * trigger «a tile was placed» that the CELL decides (no greenery and no ocean
 * beside it). Every rule reading of the card file's header is pinned here —
 * and the ONE predicate is pinned three ways: the live hook, the cell dossier
 * and the composer's forecast answer the same on every cell of the table below.
 */
const R = PartyName.REDS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedMuseum};

/** A two-seat Redux table with three QUIET real resolutions (Greens · Mars First · Reds) — the Greens rule by the starting rule. */
function table(options: {venus?: boolean} = {}): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: options.venus === true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([PartyName.GREENS, PartyName.MARS, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament, card: new RedMuseum()};
}

/** The same table with the museum on p1's table (0 data). */
function owned(options: {venus?: boolean} = {}): Table {
  const t = table(options);
  t.p1.playedCards.push(t.card);
  return t;
}

/** A free land cell with six free land neighbours and no printed bonus — a clean slate for every arrangement. */
function hub(game: IGame, skip: ReadonlyArray<Space> = []): Space {
  const board = game.board;
  const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
  const found = board.spaces.find((s) => !skip.includes(s) && free(s) && s.bonus.length === 0 &&
    board.getAdjacentSpaces(s).length === 6 && board.getAdjacentSpaces(s).every(free));
  if (found === undefined) {
    throw new Error('no hub on this board');
  }
  return found;
}

/** A free land cell with an EMPTY ocean-reserved cell beside it. */
function besideEmptyOcean(game: IGame): Space {
  const board = game.board;
  const found = board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 &&
    board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.OCEAN && n.tile === undefined) &&
    board.getAdjacentSpaces(s).every((n) => n.tile === undefined));
  if (found === undefined) {
    throw new Error('no land cell beside an empty ocean cell');
  }
  return found;
}

/** Put a tile on a cell with no fan-out (an arrangement, never a play). */
function lay(game: IGame, player: IPlayer, space: Space, tileType: TileType): void {
  game.simpleAddTile(player, space, {tileType});
}

/** The museum's facts in the cell dossier of `space`, for a prospective `kind` / `tileType` placed by `player`. */
function dossier(player: IPlayer, space: Space, kind: BoardPlacementKind, tileType?: TileType): Array<BoardFact> {
  const p = boardCellPreview(player, space, kind, tileType !== undefined ? {tileType} : undefined);
  const all = [...p.costFacts, ...p.immediateFacts, ...p.recipientFacts, ...p.warningFacts, ...p.futureScoringFacts, ...p.ruleFacts, ...(p.progressFacts ?? [])];
  return all.filter((f) => f.source?.id === CardName.RED_MUSEUM || f.title === 'Martian Fiber');
}

/** The museum's facts in the composer's forecast of `player` playing `trigger`. */
function forecastOf(player: TestPlayer, trigger: IProjectCard) {
  player.megaCredits = Math.max(player.megaCredits, 40);
  player.production.override({energy: 1});
  player.cardsInHand.push(trigger);
  return effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger)).facts.filter((f) => f.source.name === CardName.RED_MUSEUM);
}

describe('RedMuseum', () => {
  it('registers with source-backed metadata (the scan: 6 · Mars + Building · blue · the Reds · data · 1 VP per 2 data)', () => {
    const card = new RedMuseum();
    expect(card.name).eq(CardName.RED_MUSEUM);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(6);
    expect(card.tags).deep.eq([Tag.MARS, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR30');
    expect(card.resourceType).eq(CardResource.DATA);
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints).deep.eq({resourcesHere: {}, per: 2});
    expect(card.behavior, 'no play effect').is.undefined;
    expect(RED_MUSEUM_DATA_PER_TILE).eq(2);
    // The graphic, in the scan's reading order: ONE effect row «[city or special tile]* : [data][data]», then the VP line.
    type Node = {is?: string, type?: string, amount?: number, resource?: string, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    const effect = rows[0][0];
    expect(effect.is).eq('effect');
    const cause = (effect.rows?.[0] ?? []) as Array<Node>;
    const result = (effect.rows?.[2] ?? []) as Array<Node | string>;
    expect(cause[0]).deep.include({type: CardRenderItemType.CITY_OR_SPECIAL_TILE});
    expect(cause[1]).deep.include({is: 'symbol', type: '*'});
    expect(result[0]).deep.include({type: CardRenderItemType.RESOURCE, amount: 2, resource: CardResource.DATA});
    expect(result).deep.include('Effect: After you place a city or special tile on Mars ADJACENT TO NO GREENERIES OR OCEANS, add 2 data resources to this card.');
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with a NAMED reason — the Reds, «0 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: «1 of 2»; two: playable', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.placeVote(t.p1, t.parliament.slots[2], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
      t.parliament.placeVote(t.p1, t.parliament.slots[2], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Reds rule: playable with no delegate anywhere', () => {
      const t = table();
      t.p1.megaCredits = 20;
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.parliament.rulingParty()).eq(R);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('a party effect GRANTED by a card is not a road (FAQ p.19)', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.grantPartyEffect(t.p1, R, 'Council Seat');
      expect(t.parliament.access(t.p1, R).hasEffect).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('checked at the PLAY only: on the table, the effect pays whoever rules', () => {
      const t = owned();
      expect(t.parliament.rulingParty()).not.eq(R);
      addCity(t.p1, hub(t.game).id);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });
  });

  it('rule 2 — the play puts the card down and nothing else (a data holder at 0)', () => {
    const t = table();
    t.p1.megaCredits = 20;
    seatEnacted(t.parliament, quietResolutionOf(R));
    t.p1.cardsInHand.push(t.card);
    const before = t.game.cardAdjacencyPayouts.length;
    t.p1.playCard(t.card);
    runAllActions(t.game);
    expect(t.p1.tableau.has(CardName.RED_MUSEUM)).is.true;
    expect(t.card.resourceCount).eq(0);
    expect(t.p1.popWaitingFor()).is.undefined;
    expect(t.game.cardAdjacencyPayouts.length).eq(before);
  });

  describe('THE ONE PREDICATE — the hook, the dossier and the forecast agree on every cell', () => {
    type Row = {label: string, arrange: (t: Table) => Space, pays: boolean, blocked?: {oceans: number, greeneries: number}, silent?: boolean};
    const rows: ReadonlyArray<Row> = [
      {label: 'a clean cell', arrange: (t) => hub(t.game), pays: true},
      {label: 'beside an ocean tile', arrange: (t) => {
        const c = hub(t.game);
        lay(t.game, t.p2, t.game.board.getAdjacentSpaces(c)[0], TileType.OCEAN);
        return c;
      }, pays: false, blocked: {oceans: 1, greeneries: 0}},
      {label: 'beside a greenery (an opponent\'s)', arrange: (t) => {
        const c = hub(t.game);
        lay(t.game, t.p2, t.game.board.getAdjacentSpaces(c)[1], TileType.GREENERY);
        return c;
      }, pays: false, blocked: {oceans: 0, greeneries: 1}},
      {label: 'beside two oceans and a greenery', arrange: (t) => {
        const c = hub(t.game);
        const ring = t.game.board.getAdjacentSpaces(c);
        lay(t.game, t.p2, ring[0], TileType.OCEAN);
        lay(t.game, t.p2, ring[2], TileType.OCEAN);
        lay(t.game, t.p1, ring[4], TileType.GREENERY);
        return c;
      }, pays: false, blocked: {oceans: 2, greeneries: 1}},
      {label: 'beside Wetlands (both a greenery and an ocean)', arrange: (t) => {
        const c = hub(t.game);
        lay(t.game, t.p2, t.game.board.getAdjacentSpaces(c)[3], TileType.WETLANDS);
        return c;
      }, pays: false, blocked: {oceans: 1, greeneries: 1}},
      {label: 'beside Ocean City (an ocean tile)', arrange: (t) => {
        const c = hub(t.game);
        lay(t.game, t.p2, t.game.board.getAdjacentSpaces(c)[5], TileType.OCEAN_CITY);
        return c;
      }, pays: false, blocked: {oceans: 1, greeneries: 0}},
      {label: 'beside an EMPTY ocean cell (a cell, not a tile)', arrange: (t) => besideEmptyOcean(t.game), pays: true},
      {label: 'beside a hazard and an opponent\'s city', arrange: (t) => {
        const c = hub(t.game);
        const ring = t.game.board.getAdjacentSpaces(c);
        lay(t.game, t.p2, ring[0], TileType.DUST_STORM_MILD);
        lay(t.game, t.p2, ring[3], TileType.CITY);
        return c;
      }, pays: true},
    ];

    for (const row of rows) {
      it(`${row.label}: ${row.pays ? 'pays +2' : 'a named NO'} — in the hook, the dossier and the forecast alike`, () => {
        const t = owned();
        t.p1.playedCards.push(new MartianFiber());
        const cell = row.arrange(t);
        // The forecast: the cell is unknown — the museum is NAMED (no number) for every city play of its owner.
        const forecast = forecastOf(t.p1, new ImmigrantCity());
        expect(forecast).has.length(1);
        expect(forecast[0]).deep.include({certainty: 'deferred', effects: [], note: 'Depends on the cell — the cell dossier will show the details'});
        // The dossier: the same predicate on THIS cell.
        const facts = dossier(t.p1, cell, 'city');
        if (row.pays) {
          const pay = facts.find((f) => f.source?.id === CardName.RED_MUSEUM);
          expect(pay?.title).eq('No greenery or ocean beside');
          expect(pay?.delta).deep.include({icon: 'data', amount: 2, direction: 'gain'});
          const fiber = facts.find((f) => f.reaction === true);
          expect(fiber?.title, 'the table\'s answer stands under the museum\'s row').eq(CardName.MARTIAN_FIBER);
          expect(fiber?.delta).deep.include({icon: 'megacredits', amount: 2, direction: 'gain'});
          expect(fiber?.answers, 'the reply names the grant it answers — the dossier reads it under that row').eq(pay?.id);
        } else {
          expect(facts).has.length(1);
          expect(facts[0].category).eq('card-trigger');
          expect(facts[0].delta, 'a NO carries no chip').is.undefined;
          expect(museumBlockers(t.game.board, cell)).deep.eq(row.blocked);
          const expected = row.blocked!.oceans > 0 && row.blocked!.greeneries > 0 ?
            {title: 'Beside ${0} {ocean|oceans} and ${1} {greenery|greeneries} — no data', params: [String(row.blocked!.oceans), String(row.blocked!.greeneries)]} :
            row.blocked!.oceans > 0 ?
              {title: 'Beside ${0} {ocean|oceans} — no data', params: [String(row.blocked!.oceans)]} :
              {title: 'Beside ${0} {greenery|greeneries} — no data', params: [String(row.blocked!.greeneries)]};
          expect({title: facts[0].title, params: facts[0].params}).deep.eq(expected);
        }
        // The hook: the same cell, the tile landing for real.
        t.game.addCity(t.p1, cell);
        runAllActions(t.game);
        expect(t.card.resourceCount).eq(row.pays ? 2 : 0);
        // What the table answered is MEASURED around the addition (never the cell's own ocean M€).
        expect(t.game.cardAdjacencyPayouts.at(-1)?.reactions, 'Martian Fiber answers the data, and only the data')
          .deep.eq(row.pays ? {megacredits: 2} : undefined);
      });
    }

    it('a city TIER on one\'s own city (Skyscrapers): the dossier pays, the tier pays again', () => {
      const t = owned();
      const cell = hub(t.game);
      addCity(t.p1, cell.id);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
      const facts = dossier(t.p1, cell, 'city-tier');
      expect(facts.find((f) => f.source?.id === CardName.RED_MUSEUM)?.delta).deep.include({amount: 2});
      t.game.addCityTier(t.p1, cell);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(4);
    });

    it('a tier on a city that has since got an ocean beside it: the dossier says NO, the tier pays nothing', () => {
      const t = owned();
      const cell = hub(t.game);
      addCity(t.p1, cell.id);
      runAllActions(t.game);
      lay(t.game, t.p2, t.game.board.getAdjacentSpaces(cell)[0], TileType.OCEAN);
      expect(dossier(t.p1, cell, 'city-tier')[0]?.title).eq('Beside ${0} {ocean|oceans} — no data');
      t.game.addCityTier(t.p1, cell);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    for (const slot of [SpaceName.GANYMEDE_COLONY, SpaceName.PHOBOS_SPACE_HAVEN]) {
      it(`off the Mars grid (${slot === SpaceName.GANYMEDE_COLONY ? 'Ganymede' : 'Phobos'}): silent in the dossier and the forecast, nothing paid`, () => {
        const t = owned();
        const space = t.game.board.getSpaceOrThrow(slot);
        expect(t.game.board.onMarsGrid(space)).is.false;
        expect(dossier(t.p1, space, 'city', TileType.CITY)).deep.eq([]);
        t.game.addCity(t.p1, space);
        runAllActions(t.game);
        expect(t.card.resourceCount).eq(0);
      });
    }

    it('off the Mars grid — the forecast of an off-Mars city play (Ganymede Colony) names nothing', () => {
      const t = owned();
      t.p1.megaCredits = 40;
      expect(forecastOf(t.p1, new GanymedeColony())).deep.eq([]);
    });

    it('Aurora Station\'s cell beside the Venus track (TR27) is OFF the grid: nothing paid', () => {
      const t = owned({venus: true});
      const space = t.game.board.getSpaceOrThrow(SpaceName.AURORA_STATION);
      expect(space.spaceType).eq(SpaceType.COLONY);
      expect(t.game.board.onMarsGrid(space)).is.false;
      expect(dossier(t.p1, space, 'city', TileType.CITY)).deep.eq([]);
      t.game.addCity(t.p1, space);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });
  });

  describe('rule 4 — WHICH tile: a city or a special tile; never a greenery, an ocean or a hazard', () => {
    it('the Capital (a city and a special tile): +2', () => {
      const t = owned();
      t.game.addTile(t.p1, hub(t.game), {tileType: TileType.CAPITAL});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    it('Nuclear Zone (a special tile): the forecast names the museum, the dossier and the tile pay +2', () => {
      const t = owned();
      t.p1.megaCredits = 40;
      const fc = forecastOf(t.p1, new NuclearZone());
      expect(fc).has.length(1);
      expect(fc[0].effects).deep.eq([]);
      const cell = hub(t.game);
      expect(dossier(t.p1, cell, 'land', TileType.NUCLEAR_ZONE).find((f) => f.source?.id === CardName.RED_MUSEUM)?.delta).deep.include({amount: 2});
      t.game.addTile(t.p1, cell, {tileType: TileType.NUCLEAR_ZONE});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    it('Mohole Area on an ocean-reserved cell, no ocean TILE beside it: +2 (an empty ocean cell is not an ocean)', () => {
      const t = owned();
      const board = t.game.board;
      const cell = board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined && board.getAdjacentSpaces(s).every((n) => n.tile === undefined));
      expect(cell).is.not.undefined;
      t.game.addTile(t.p1, cell!, {tileType: TileType.MOHOLE_AREA});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    it('Ecological Zone (must stand beside a greenery): never pays', () => {
      const t = owned();
      const cell = hub(t.game);
      addGreenery(t.p1, t.game.board.getAdjacentSpaces(cell)[0].id);
      runAllActions(t.game);
      t.game.addTile(t.p1, cell, {tileType: TileType.ECOLOGICAL_ZONE});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('a greenery or an ocean on a clean cell: nothing — and the dossier is silent', () => {
      const t = owned();
      const cell = hub(t.game);
      expect(dossier(t.p1, cell, 'greenery')).deep.eq([]);
      addGreenery(t.p1, cell.id);
      t.game.addOcean(t.p1, t.game.board.getAvailableSpacesForOcean(t.p1)[0]);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
      t.p1.megaCredits = 40;
      expect(forecastOf(t.p1, new Mangrove()), 'a greenery play names nothing').deep.eq([]);
    });

    it('a MOVED city (TR14) is read on its NEW cell', () => {
      const t = owned();
      const from = hub(t.game);
      addCity(t.p1, from.id);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
      const to = t.game.board.getAdjacentSpaces(from).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
      t.game.moveCityTile(t.p1, from, to!);
      runAllActions(t.game);
      expect(t.card.resourceCount, 'the move lands the city on a clean cell — the museum pays again').eq(4);
    });
  });

  describe('rule 3 — only the OWNER\'s tile', () => {
    it('an opponent\'s city on a clean cell: nothing; the dossier of the opponent\'s pick is silent; their forecast names nothing', () => {
      const t = owned();
      const cell = hub(t.game);
      expect(dossier(t.p2, cell, 'city')).deep.eq([]);
      t.p2.megaCredits = 40;
      expect(forecastOf(t.p2, new ImmigrantCity())).deep.eq([]);
      t.game.addCity(t.p2, cell);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('the Moon is not Mars: a city-typed tile reported under the lunar board answers nothing', () => {
      const t = owned();
      const cell = hub(t.game);
      lay(t.game, t.p1, cell, TileType.CITY);
      t.card.onTilePlaced(t.p1, t.p1, cell, BoardType.MOON);
      expect(t.card.resourceCount).eq(0);
    });

    it('a human at MarsBot\'s table: the bot\'s city pays nothing, the human\'s pays +2', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new RedMuseum();
      human.playedCards.push(card);
      const first = hub(game);
      game.addCity(bot, first);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      game.addCity(human, hub(game, [first, ...game.board.getAdjacentSpaces(first)]));
      runAllActions(game);
      expect(card.resourceCount).eq(2);
    });
  });

  describe('rule 7 — the payout: +2 data HERE, in the hook\'s own scope, recorded for the scene', () => {
    it('one effect-triggered event of the museum on \'tile-placed\', the shared addition line, Martian Fiber after it', () => {
      const t = owned();
      t.p1.playedCards.push(new MartianFiber());
      const events = t.game.events.events.length;
      const log = t.game.gameLog.length;
      const cell = hub(t.game);
      t.game.addCity(t.p1, cell);
      runAllActions(t.game);
      const fired = t.game.events.events.slice(events).filter((e) => e.type === 'effect-triggered' &&
        e.source !== undefined && 'card' in e.source && e.source.card === CardName.RED_MUSEUM);
      expect(fired).has.length(1);
      expect(fired[0].trigger).eq('tile-placed');
      expect(fired[0].player).eq(t.p1.color);
      const lines = t.game.gameLog.slice(log).map(formatMessage);
      const added = lines.findIndex((l) => l.includes(`added 2 Data to ${CardName.RED_MUSEUM}`));
      expect(added, JSON.stringify(lines)).greaterThan(-1);
    });

    it('ONE record per tile: cause tile-placed, the placed cell sending both units, before, the MEASURED answer', () => {
      const t = owned();
      t.p1.playedCards.push(new MartianFiber());
      t.card.resourceCount = 3;
      const cell = hub(t.game);
      t.game.addCity(t.p1, cell);
      runAllActions(t.game);
      expect(t.game.cardAdjacencyPayouts).has.length(1);
      const record = t.game.cardAdjacencyPayouts[0];
      expect(record).deep.include({
        cause: 'tile-placed', color: t.p1.color, card: CardName.RED_MUSEUM, spaceId: cell.id, target: CardName.RED_MUSEUM,
        resource: CardResource.DATA, amount: 2, before: 3, reactions: {megacredits: 2},
      });
      expect(record.basis, 'no per-neighbour basis').is.undefined;
      expect(record.neighbours).deep.eq([{spaceId: cell.id, units: 2}]);
      expect(Math.floor(record.seq / 100), 'the seq law: gameAge · 100 + n').eq(t.game.gameAge);
    });

    it('a NO publishes no record', () => {
      const t = owned();
      const cell = hub(t.game);
      lay(t.game, t.p2, t.game.board.getAdjacentSpaces(cell)[0], TileType.OCEAN);
      t.game.addCity(t.p1, cell);
      runAllActions(t.game);
      expect(t.game.cardAdjacencyPayouts).is.empty;
    });
  });

  it('rule 8 — 1 VP per 2 data here: 0 / 1 / 2 / 3 data → 0 / 0 / 1 / 1 VP', () => {
    const t = owned();
    for (const [data, vp] of [[0, 0], [1, 0], [2, 1], [3, 1]] as const) {
      t.card.resourceCount = data;
      expect(t.card.getVictoryPoints(t.p1), `${data} data`).eq(vp);
    }
  });

  it('rule 10 — save / load: the count survives, the hook reads the loaded board', () => {
    const t = owned();
    addCity(t.p1, hub(t.game).id);
    runAllActions(t.game);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const p1 = reloaded.getPlayerById(t.p1.id);
    const card = p1.tableau.get(CardName.RED_MUSEUM);
    expect(card?.resourceCount).eq(2);
    expect(reloaded.cardAdjacencyPayouts, 'the scene\'s record is presentation only').is.empty;
    const used = reloaded.board.spaces.filter((s) => s.tile !== undefined);
    const next = hub(reloaded, used.flatMap((s) => [s, ...reloaded.board.getAdjacentSpaces(s)]));
    reloaded.addCity(p1, next);
    runAllActions(reloaded);
    expect(card?.resourceCount).eq(4);
  });
});
