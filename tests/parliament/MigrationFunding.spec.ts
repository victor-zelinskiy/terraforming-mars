import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  MIGRATION_FUNDING, MIGRATION_FUNDING_CODE, MIGRATION_FUNDING_ID, MIGRATION_FUNDING_MEGACREDITS, MIGRATION_FUNDING_PER_UNIT, MIGRATION_FUNDING_SKIP_REASON,
} from '../../src/server/parliament/resolutions/marsFirst/MigrationFunding';
import {COLONIZATION_FUNDING_PRODUCTION} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {GENEROUS_FUNDING_MEGACREDITS} from '../../src/server/parliament/resolutions/greens/GenerousFunding';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {countSpacesToward, resolutionCountKind, spaceCountVerdict} from '../../src/common/parliament/resolutionCounts';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {TileType} from '../../src/common/TileType';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../src/common/cards/render/CardRenderSymbolType';
import {isICardRenderItem, isICardRenderSymbol} from '../../src/common/cards/render/Types';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {Space} from '../../src/server/boards/Space';
import {addCity, addGreenery, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * MIGRATION FUNDING (Turmoil Redux, RX21) — Colonization Funding's twin over
 * the OTHER half of the board, and the first count paid by a QUANTITY the
 * engine sums: 2 × (C + I) M€ for every participant, C the player's CITIES
 * ON MARS with EACH TIER OF A STACK SEPARATELY (`MarsBoard.countCities
 * (player, 'onmars')`), I the Redux influence after the winner's Agenda step.
 *
 * What these specs pin: the formula's examples (influence pays on its own, no
 * cap); the count is THE ENGINE's quantity — three cities are 3, a stack of 2
 * among them makes 4, a space city, a rival's city and a greenery are nothing,
 * a Capital is a city; THE DIVERGENCE the card was written against —
 * Skyscrapers' `marsCities` (the DESTINATIONS of a tier, a cell once) reads
 * the same cells and stays 3 where this count reads 4, and the two part by
 * exactly the stack; the shared cell predicate the stand uses agrees with the
 * engine over a corpus of boards, heights included; the enactment is CASH
 * through the standard gain (never production); the record freezes the
 * count WITH ITS CELLS AND THEIR HEIGHTS and a reload pays nothing twice; a
 * zero names itself; MarsBot is never counted or paid; the model carries the
 * cells and the heights to the client.
 */
const FUNDING = resolutionInstanceId(MIGRATION_FUNDING_ID, 0);
const GANYMEDE = SpaceName.GANYMEDE_COLONY;

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Migration Funding in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, FUNDING);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomeOf(parliament: Parliament, player: TestPlayer): SerializedEnactOutcome | undefined {
  const outcomes = parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? [];
  return outcomes.find((o) => o.player === player.id && o.step === 'megacredits' && o.kind !== 'reaction');
}

/** A city for `player` on a QUIET cell (no printed bonus, no tile or ocean beside it) — placed silently, outside any effect. */
function seatCity(game: IGame, player: TestPlayer, tile: TileType = TileType.CITY): Space {
  const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId &&
    s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined || a.spaceType === SpaceType.OCEAN));
  if (space === undefined) {
    throw new Error('no quiet cell for a city');
  }
  space.tile = {tileType: tile};
  space.player = player;
  return space;
}

/** The ids of `player`'s cities on Mars, as THE ENGINE lists them. */
function engineCitiesOnMars(player: TestPlayer): Array<string> {
  return player.game.board.getCitiesOnMars(player).map((s) => s.id);
}

describe('MigrationFunding', () => {
  describe('the catalog entry', () => {
    it('is RX21 of Mars First, dealt as ONE card in every game (no expansion needed), with the two-cities-on-Mars quest — no cap, no winner part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(MIGRATION_FUNDING_ID)).eq(MIGRATION_FUNDING);
      expect(MIGRATION_FUNDING_CODE).eq('RX21');
      expect(MIGRATION_FUNDING_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX21')).eq(MIGRATION_FUNDING);
      expect(MIGRATION_FUNDING.party).eq(PartyName.MARS);
      expect(MIGRATION_FUNDING.copies).eq(1);
      expect(MIGRATION_FUNDING.compatibility, 'a base card: a city on Mars needs no expansion').is.undefined;
      expect(MIGRATION_FUNDING.quest).deep.eq({goal: {kind: 'tile', tile: 'city'}, count: 2});
      expect(MIGRATION_FUNDING.scaled).deep.eq([MIGRATION_FUNDING_MEGACREDITS]);
      expect(MIGRATION_FUNDING.immediateSteps?.map((s) => s.key)).deep.eq(['megacredits']);
      expect(MIGRATION_FUNDING.winnerSteps, 'no winner-only part').is.undefined;
      expect(MIGRATION_FUNDING.winnerReward, 'no winner tile either').is.undefined;
      expect(MIGRATION_FUNDING.worldSteps).is.undefined;
      expect(MIGRATION_FUNDING.passive).is.undefined;
      expect(MIGRATION_FUNDING.tileGrant, 'no tile is granted — the cities are COUNTED').is.undefined;
      expect(MIGRATION_FUNDING_MEGACREDITS.cap, 'the card prints no maximum').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === FUNDING)).has.length(1);
    });

    it('the formula: 2 × (C + I), uncapped — every example of the brief; influence pays on its own', () => {
      const cases: Array<[number, number, number]> = [
        [0, 0, 0], [0, 3, 6], [3, 0, 6], [1, 1, 4], [3, 2, 10], [4, 3, 14], [7, 5, 24],
      ];
      for (const [cities, influence, expected] of cases) {
        expect(scaledAmount(MIGRATION_FUNDING_MEGACREDITS, influence, cities), `C=${cities} I=${influence}`).eq(expected);
      }
      expect(MIGRATION_FUNDING_PER_UNIT).eq(2);
      expect(MIGRATION_FUNDING_MEGACREDITS.perInfluence).eq(2);
      expect(MIGRATION_FUNDING_MEGACREDITS.count).deep.eq({id: 'marsCityTiers', per: 2});
    });

    it('shares the family\'s mechanism: the SUPPLY unit of Generous Funding, the BOARD counter of Colonization Funding — and differs in the MEASURE', () => {
      expect(MIGRATION_FUNDING_MEGACREDITS.unit).deep.eq(GENEROUS_FUNDING_MEGACREDITS.unit);
      expect(MIGRATION_FUNDING_MEGACREDITS.recipient).eq(COLONIZATION_FUNDING_PRODUCTION.recipient);
      expect(resolutionCountKind('marsCityTiers')).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'tiers'});
      expect(resolutionCountKind('spaceCities')).deep.eq({kind: 'board', tiles: 'spaceCity', measure: 'cells'});
      // THE TRAP, stated in the declaration: Skyscrapers' count over the SAME tile is the other measure.
      expect(resolutionCountKind('marsCities')).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'cells'});
      expect(familyOf(MIGRATION_FUNDING), 'the stand opens the board-count family from the declaration alone').eq('counted-board');
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('marsCityTiers');
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG), 'Skyscrapers\' count of destinations stands beside it').includes('marsCities');
    });

    it('the face prints «2 [M€] / [city] + [influence]» with a BARE city (no footnote spark — that is the space city\'s); the quest graphic is two cities', () => {
      const face = MIGRATION_FUNDING.renderData.rows[0];
      const items = face.filter(isICardRenderItem).map((item) => item.type);
      expect(items).includes(CardRenderItemType.MEGACREDITS);
      expect(items).includes(CardRenderItemType.CITY);
      expect(items).includes(CardRenderItemType.INFLUENCE);
      expect(face.filter(isICardRenderSymbol).map((symbol) => symbol.type)).includes(CardRenderSymbolType.SLASH);
      expect(face.filter(isICardRenderSymbol).some((symbol) => symbol.type === CardRenderSymbolType.ASTERIX), 'no spark: a city ON Mars').is.false;
      expect(MIGRATION_FUNDING.renderData.rows, 'no cap line').has.length(1);
      const [row] = questRenderData(MIGRATION_FUNDING.quest).rows;
      expect(row.filter(isICardRenderItem).map((item) => item.type)).deep.eq([CardRenderItemType.CITY, CardRenderItemType.CITY]);
    });
  });

  describe('which cities count (C) — the engine\'s own QUANTITY, never the length of the cell list', () => {
    it('counts the player\'s cities on Mars and names the CELLS with their HEIGHTS: three cities are 3, each of height 1', () => {
      const [game, p1] = reduxGame();
      expect(resolutionCount(p1, 'marsCityTiers')).deep.eq({id: 'marsCityTiers', count: 0, cards: [], spaces: [], tiers: []});
      const a = seatCity(game, p1);
      const b = seatCity(game, p1);
      const c = seatCity(game, p1);
      const count = resolutionCount(p1, 'marsCityTiers');
      expect(count.count).eq(3);
      expect(count.spaces).deep.eq(engineCitiesOnMars(p1));
      expect(count.spaces).has.members([a.id, b.id, c.id]);
      expect(count.tiers).deep.eq([1, 1, 1]);
      expect(count.cards, 'a tile has no card').deep.eq([]);
      expect(count.units, 'no per-card column on a board count').is.undefined;
      expect(count.count).eq(game.board.countCities(p1, 'onmars'));
    });

    it('a stack of 2 among three cities makes 4 — the record names the stacked cell with its height, and the number is `countCities`', () => {
      const [game, p1] = reduxGame();
      const a = seatCity(game, p1);
      const stacked = seatCity(game, p1);
      const c = seatCity(game, p1);
      stacked.stackHeight = 2;
      const count = resolutionCount(p1, 'marsCityTiers');
      expect(count.count).eq(4);
      expect(count.count).eq(game.board.countCities(p1, 'onmars'));
      expect(count.spaces, 'three cells — the stacked one is NOT listed twice').has.length(3);
      expect(count.tiers?.[count.spaces!.indexOf(stacked.id)]).eq(2);
      expect(count.tiers?.[count.spaces!.indexOf(a.id)]).eq(1);
      expect(count.tiers?.[count.spaces!.indexOf(c.id)]).eq(1);
      expect(count.tiers?.reduce((sum, n) => sum + n, 0), 'the heights add up to the number').eq(4);
      // A tier built by the engine's own commit (Skyscrapers' path) counts the same.
      game.addCityTier(p1, a);
      expect(resolutionCount(p1, 'marsCityTiers').count).eq(5);
      expect(game.board.countCities(p1, 'onmars')).eq(5);
    });

    it('a space city is off Mars; a rival\'s city is theirs; a greenery is not a city; a Capital IS a city', () => {
      const [game, p1, p2] = reduxGame();
      const ganymede = game.board.getSpaceOrThrow(GANYMEDE);
      ganymede.tile = {tileType: TileType.CITY};
      ganymede.player = p1;
      seatCity(game, p2);
      addGreenery(p1);
      expect(resolutionCount(p1, 'marsCityTiers')).deep.eq({id: 'marsCityTiers', count: 0, cards: [], spaces: [], tiers: []});
      expect(resolutionCount(p2, 'marsCityTiers').count).eq(1);
      const capital = seatCity(game, p1, TileType.CAPITAL);
      expect(resolutionCount(p1, 'marsCityTiers')).deep.eq({id: 'marsCityTiers', count: 1, cards: [], spaces: [capital.id], tiers: [1]});
    });

    it('THE DIVERGENCE: Skyscrapers\' `marsCities` (destinations, a cell once) reads the SAME cells and stays 3 where this count is 4 — they part by exactly the stack', () => {
      const [game, p1] = reduxGame();
      seatCity(game, p1);
      seatCity(game, p1).stackHeight = 2;
      seatCity(game, p1);
      const destinations = resolutionCount(p1, 'marsCities');
      const quantity = resolutionCount(p1, 'marsCityTiers');
      expect(destinations.count, 'a cell once, whatever its stack').eq(3);
      expect(quantity.count, 'the stacks summed').eq(4);
      expect(quantity.spaces).deep.eq(destinations.spaces);
      expect(destinations.tiers, 'the destinations carry no heights — every cell is worth 1 there').is.undefined;
      expect(quantity.count - destinations.count, 'the difference is the stack and nothing else').eq(1);
      expect(destinations.spaces).deep.eq(game.board.getAvailableSpacesForType(p1, 'city-tier').map((s) => s.id));
      // Without a stack the two agree on every board — which is exactly why the id and the measure must differ.
      const [game2, q1] = reduxGame();
      seatCity(game2, q1);
      seatCity(game2, q1);
      expect(resolutionCount(q1, 'marsCities').count).eq(resolutionCount(q1, 'marsCityTiers').count);
    });

    it('PARITY: the shared cell predicate (the stand\'s) agrees with the engine over a corpus of boards — cells, number AND heights', () => {
      const corpus: Array<(game: IGame, p1: TestPlayer, p2: TestPlayer) => void> = [
        () => {},
        (game, p1) => {
          seatCity(game, p1);
        },
        (game, p1) => {
          seatCity(game, p1).stackHeight = 3;
          seatCity(game, p1);
        },
        (game, p1, p2) => {
          seatCity(game, p1);
          seatCity(game, p2).stackHeight = 2;
          const ganymede = game.board.getSpaceOrThrow(GANYMEDE);
          ganymede.tile = {tileType: TileType.CITY};
          ganymede.player = p1;
        },
        (game, p1) => {
          seatCity(game, p1).stackHeight = 2;
          seatCity(game, p1).stackHeight = 2;
          addGreenery(p1);
          seatCity(game, p1, TileType.CAPITAL);
        },
      ];
      for (const arrange of corpus) {
        const [game, p1, p2] = reduxGame();
        arrange(game, p1, p2);
        const own = game.board.spaces.filter((space) => space.player === p1);
        const stand = countSpacesToward('marsCityTiers', own);
        const engine = resolutionCount(p1, 'marsCityTiers');
        expect(stand.spaces, `board #${corpus.indexOf(arrange)}: the stand's predicate names the engine's cells`).deep.eq(engine.spaces);
        expect(stand.tiers, `board #${corpus.indexOf(arrange)}: …with the engine's heights`).deep.eq(engine.tiers);
        expect(stand.count, `board #${corpus.indexOf(arrange)}: …and the engine's number`).eq(engine.count);
        expect(stand.count).eq(game.board.countCities(p1, 'onmars'));
      }
      // …and each verdict names its reason; a stack is one cell to the verdict — the MEASURE weighs it.
      expect(spaceCountVerdict('marsCityTiers', {id: '35', spaceType: SpaceType.LAND, tile: {tileType: TileType.CITY}, stackHeight: 2})).deep.eq({counts: true});
      expect(spaceCountVerdict('marsCityTiers', {id: GANYMEDE, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}})).deep.eq({counts: false, reason: 'Off Mars — a space city'});
      expect(spaceCountVerdict('marsCityTiers', {id: '36', spaceType: SpaceType.LAND, tile: {tileType: TileType.GREENERY}})).deep.eq({counts: false, reason: 'No city tile here'});
    });
  });

  describe('the enactment', () => {
    it('pays EVERY participant 2 × (C + I) M€ into the supply — voters or not — through the standard gain, never production; the record carries the cells and their heights', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner, one delegate: no party effect) — Agenda 0 → step 1 in the phase = influence 1; three cells, one a stack of 2 = 4 cities.
      const a = seatCity(game, p1);
      const stacked = seatCity(game, p1);
      seatCity(game, p1);
      stacked.stackHeight = 2;
      // p2 never voted — influence 3, no city on Mars: influence pays on its own.
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(FUNDING);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      const one = outcomeOf(parliament, p1)!;
      const two = outcomeOf(parliament, p2)!;
      expect(one).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 10, count: 4, influence: 1});
      expect(one.after! - one.before!, '(4 + I 1) × 2').eq(10);
      expect(p1.megaCredits).eq(one.after);
      expect(one.counted, 'no card is counted').deep.eq([]);
      expect(one.countedSpaces, 'the CELLS are').has.length(3);
      expect(one.countedSpaces).includes(a.id);
      expect(one.countedTiers, '…with their heights, aligned').has.length(3);
      expect(one.countedTiers![one.countedSpaces!.indexOf(stacked.id)]).eq(2);
      expect(one.countedTiers!.reduce((sum, n) => sum + n, 0)).eq(4);
      expect(one.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
      expect(two).deep.include({kind: 'stock', amount: 6, count: 0, influence: 3});
      expect(two.after! - two.before!, '0 cities + I 3, × 2').eq(6);
      expect(two.countedSpaces).deep.eq([]);
      expect(two.countedTiers).deep.eq([]);
      // CASH, not production: the card's ONLY mutations are the two supply gains.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === MIGRATION_FUNDING_ID);
      expect(mine.filter((e) => e.type === 'resource-changed'), 'one gain per seat').has.length(2);
      expect(mine.filter((e) => e.type === 'production-changed'), 'and not one step of production').has.length(0);
    });

    it('a total of ZERO is named and skipped — «no cities on Mars and no influence», never «no influence» alone; the record keeps its empty lists', () => {
      const [game, p1, p2, parliament] = stage();
      seatCity(game, p1);
      const before = p2.megaCredits;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'stock', amount: 4, count: 1, influence: 1});
      const two = outcomeOf(parliament, p2)!;
      expect(two).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 0, reason: MIGRATION_FUNDING_SKIP_REASON});
      expect(MIGRATION_FUNDING_SKIP_REASON).eq('No cities on Mars and no influence');
      expect(two.countedSpaces).deep.eq([]);
      expect(two.countedTiers).deep.eq([]);
      expect(p2.megaCredits - before, 'the production phase\'s income only — the card paid nothing').eq(p2.production.megacredits + p2.terraformRating);
      expect(game.gameLog.filter((entry) => entry.message === '${0} has no city on Mars and no influence — no ${1} from ${2}'), 'p2\'s zero is named').has.length(1);
    });

    it('a neutral winner cancels nothing: every participant is still paid, and nobody gets a winner-only part', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, FUNDING);
      parliament.addNeutralVote(parliament.slots[0]);
      seatCity(game, p1).stackHeight = 2;
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(FUNDING);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 4, count: 2, influence: 0});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 2, count: 0, influence: 1});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part !== 'winner'), 'no winner part at all').is.true;
    });

    it('the journal carries ONE line per player with the whole calculation and the resolution as its source', () => {
      const [game, p1, , parliament] = stage();
      seatCity(game, p1).stackHeight = 2;
      seatCity(game, p1);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the winner's step lands on influence 3
      endGeneration(game);
      runAllActions(game);
      const paid = game.gameLog.filter((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: ${4} city(-ies) on Mars × 2 + ${5} influence × 2 (${6} → ${7})');
      expect(paid).has.length(1);
      const data = paid[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(MIGRATION_FUNDING_ID);
      const one = outcomeOf(parliament, p1)!;
      expect(one).deep.include({amount: 12, count: 3, influence: 3});
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['12', '3', '3', String(one.before), String(one.after)]);
      const gains = game.events.events.filter((e) => e.type === 'resource-changed' && e.player === p1.color &&
        e.source?.kind === 'resolution' && e.source.id === MIGRATION_FUNDING_ID);
      expect(gains).has.length(1);
    });
  });

  describe('once per enactment — the count is frozen in the record', () => {
    it('a later city, a later TIER, a later influence and a change of government never recompute what was paid', () => {
      const [game, p1, , parliament] = stage();
      const city = seatCity(game, p1);
      endGeneration(game);
      runAllActions(game);
      const paid = p1.megaCredits;
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({amount: 4, count: 1, influence: 1});
      expect(outcome?.countedSpaces).deep.eq([city.id]);
      expect(outcome?.countedTiers).deep.eq([1]);
      // A tier onto that city, another city and more influence afterwards: nothing moves.
      game.addCityTier(p1, city);
      seatCity(game, p1);
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(paid);
      expect(outcomeOf(parliament, p1)).deep.eq(outcome);
      expect(resolutionCount(p1, 'marsCityTiers').count, 'the live count moved — the record did not').eq(3);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.megaCredits).eq(paid);
    });

    it('a reload after the enactment pays nothing again; the recorded cells AND heights survive the save', () => {
      const [game, p1, , parliament] = stage();
      const stacked = seatCity(game, p1);
      stacked.stackHeight = 2;
      seatCity(game, p1);
      endGeneration(game);
      runAllActions(game);
      const paid = p1.megaCredits;
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(one.megaCredits).eq(paid);
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'megacredits')).deep.eq(
        parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'megacredits'));
      settleParliamentGates(live);
      const record = live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === 'megacredits');
      expect(record).deep.include({amount: 8, count: 3, influence: 1});
      expect(record?.countedSpaces).has.length(2);
      expect(record?.countedTiers![record.countedSpaces!.indexOf(stacked.id)]).eq(2);
      expect(live.board.getSpaceOrThrow(stacked.id).stackHeight, 'the stack itself survived too').eq(2);
    });
  });

  describe('the chairman quest — 2 cities on Mars', () => {
    /** A city on Mars placed by the player's OWN action (the engine's standard placement under an action scope). */
    function placeMarsCityAsAction(player: TestPlayer): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.IMMIGRANT_CITY, owner: player.color}, {category: 'card-play'});
      try {
        addCity(player);
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('the enactment moves no progress and a standing city counts nothing retroactively; two cities the player places complete it', () => {
      const [game, p1, p2, parliament] = stage();
      seatCity(game, p1);
      seatCity(game, p1);
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(MIGRATION_FUNDING_ID);
      expect(resolutionCount(p1, 'marsCityTiers').count, 'the counter reads the table').eq(2);
      expect(parliament.questProgressOf(p1), 'the quest reads only what is PLACED by an action since the enactment').eq(0);
      placeMarsCityAsAction(p2);
      expect(parliament.questProgressOf(p2)).eq(1);
      placeMarsCityAsAction(p2);
      expect(parliament.quest?.completedBy).eq(p2.id);
      answerQuestGate(game, p2);
      expect(parliament.chairman).eq(p2.id);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never counted, never paid, and its cities are nobody\'s; the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, FUNDING);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      const mine = game.board.getAvailableSpacesForCity(human).find((s) => s.bonus.length === 0 && s.bonus.every((b) => b !== SpaceBonus.OCEAN))!;
      mine.tile = {tileType: TileType.CITY};
      mine.player = human;
      const bots = game.board.getAvailableSpacesForCity(bot).find((s) => !game.board.getAdjacentSpaces(s).some((a) => a.id === mine.id))!;
      bots.tile = {tileType: TileType.CITY};
      bots.player = bot;
      bots.stackHeight = 2;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player)).deep.eq([human.id]);
      const record = parliament.lastPhase?.outcomes?.[0];
      expect(record).deep.include({kind: 'stock', amount: 4, count: 1, influence: 1});
      expect(record?.countedSpaces, 'the bot\'s stack is nobody\'s here').deep.eq([mine.id]);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number, CELLS and HEIGHTS) rides the model; the outcome reaches the client with the cells and the heights', () => {
      const [game, p1, p2, parliament] = stage();
      const a = seatCity(game, p1);
      const stacked = seatCity(game, p1);
      stacked.stackHeight = 2;
      const ganymede = game.board.getSpaceOrThrow(GANYMEDE);
      ganymede.tile = {tileType: TileType.CITY};
      ganymede.player = p1;
      const model = getParliamentModel(game, p2);
      const counts = model?.players.find((p) => p.color === p1.color)?.counts;
      const mine = counts?.find((c) => c.id === 'marsCityTiers');
      expect(mine?.count).eq(3);
      expect(mine?.spaces).has.members([a.id, stacked.id]);
      expect(mine?.tiers![mine.spaces!.indexOf(stacked.id)]).eq(2);
      expect(counts?.find((c) => c.id === 'marsCities'), 'the destinations count travels beside it and stays at the cells').deep.include({count: 2});
      expect(model?.players.find((p) => p.color === p2.color)?.counts?.find((c) => c.id === 'marsCityTiers')).deep.eq(
        {id: 'marsCityTiers', count: 0, cards: [], spaces: [], tiers: []});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const record = last?.outcomes?.find((o) => o.player === p1.color);
      expect(record).deep.include({kind: 'stock', amount: 8, count: 3, influence: 1});
      expect(record?.countedSpaces).has.length(2);
      expect(record?.countedTiers![record.countedSpaces!.indexOf(stacked.id)]).eq(2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(2);
    });
  });
});
