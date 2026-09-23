import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {
  DEVELOPMENT_CRAZE, DEVELOPMENT_CRAZE_CODE, DEVELOPMENT_CRAZE_ID, DEVELOPMENT_CRAZE_STEEL, repeatPlacementBonuses,
} from '../../src/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderEffect, isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {Board} from '../../src/server/boards/Board';
import {Space} from '../../src/server/boards/Space';
import {GameEvent} from '../../src/common/events/GameEvent';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {ICard} from '../../src/server/cards/ICard';
import {addCity, addGreenery, addOcean, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * DEVELOPMENT CRAZE (Turmoil Redux, RX10) — the first resolution with a LIVE
 * PASSIVE: steel by influence at the enactment, and — while the card stands
 * enacted — every placement's bonuses on Mars PAID A SECOND TIME through the
 * engine's own grant entries, under the resolution's source.
 *
 * What these specs pin: the steel by each seat's OWN influence (a named skip
 * at 0); the printed bonuses and the ocean adjacency paid twice under the
 * resolution's `effect-triggered` marker, with the ECHO the scene reads; a
 * bare cell raises nothing; off Mars nothing doubles; a cover repeats only the
 * adjacency; a seat without the law is paid once; the doubling ENDS with the
 * law; a card-resource bonus asks twice; a pay-to-use bonus is offered twice
 * when affordable and NAMED as skipped when not; the forecast twin; the quest
 * counts a city and a special tile, never a greenery; MarsBot is never paid.
 */
const CRAZE = resolutionInstanceId(DEVELOPMENT_CRAZE_ID, 0);

function reduxGame(options: {board?: BoardName, ares?: boolean} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {
    turmoilReduxExpansion: true, coloniesExtension: true,
    boardName: options.board ?? BoardName.THARSIS,
    aresExtension: options.ares === true,
  });
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, CRAZE);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The card ENACTED without a sitting — the passive alone is under test. */
function enacted(options: {board?: BoardName, ares?: boolean} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame(options);
  parliament.enacted = CRAZE;
  return [game, p1, p2, parliament];
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomesOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

/** Does `space` touch an ocean tile? */
function nextToOcean(game: IGame, space: Space): boolean {
  return game.board.getAdjacentSpaces(space).some((a) => Board.isOceanSpace(a));
}

/** A free land cell printing exactly `bonus`, away from any ocean tile. */
function landWith(game: IGame, player: IPlayer, bonus: ReadonlyArray<SpaceBonus>): Space {
  const space = game.board.getAvailableSpacesOnLand(player).find((s) =>
    s.bonus.length === bonus.length && bonus.every((b, i) => s.bonus[i] === b) && !nextToOcean(game, s));
  if (space === undefined) {
    throw new Error(`no free land cell printing ${bonus.join('+')}`);
  }
  return space;
}

/** A free land cell with NO printed bonus, away from any ocean tile. */
function bareLand(game: IGame, player: IPlayer): Space {
  return landWith(game, player, []);
}

/** The resolution's `effect-triggered` markers in the stream. */
function crazeMarkers(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution' && e.source.id === DEVELOPMENT_CRAZE_ID);
}

/** The resource deltas recorded UNDER the resolution's marker. */
function crazeGains(game: IGame, resource: Resource): number {
  const markers = new Set(crazeMarkers(game).map((m) => m.id));
  return game.events.events
    .filter((e) => e.type === 'resource-changed' && e.parentId !== undefined && markers.has(e.parentId))
    .reduce((sum, e) => sum + (e.impact.stock?.[resource] ?? 0), 0);
}

function resolutionFactsOf(player: IPlayer, card: ICard) {
  const forecast = effectForecastForPlay(player, card, cardPlayPreview(player, card));
  return allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution' && f.source.name === DEVELOPMENT_CRAZE_ID);
}

describe('DevelopmentCraze', () => {
  describe('the catalog entry', () => {
    it('is RX10 of Mars First, ONE card: steel by influence for everyone, a LIVE passive with its forecast, the city-or-special quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(DEVELOPMENT_CRAZE_ID)).eq(DEVELOPMENT_CRAZE);
      expect(DEVELOPMENT_CRAZE_CODE).eq('RX10');
      expect(DEVELOPMENT_CRAZE_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX10')).eq(DEVELOPMENT_CRAZE);
      expect(DEVELOPMENT_CRAZE.party).eq(PartyName.MARS);
      expect(DEVELOPMENT_CRAZE.compatibility, 'a base card').is.undefined;
      expect(DEVELOPMENT_CRAZE.quest).deep.eq({goal: {kind: 'tile', tile: 'cityOrSpecial'}, count: 1});
      expect(DEVELOPMENT_CRAZE.scaled).deep.eq([DEVELOPMENT_CRAZE_STEEL]);
      expect(DEVELOPMENT_CRAZE.winnerSteps, 'no winner-only part').is.undefined;
      expect(DEVELOPMENT_CRAZE.passive, 'the live passive').is.not.undefined;
      expect(typeof DEVELOPMENT_CRAZE.passive?.forecast, 'the honesty law: a passive declares its forecast').eq('function');
      expect(DEVELOPMENT_CRAZE.text.passive, 'the sitting reads the passive').is.a('string').and.not.empty;
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === CRAZE)).has.length(1);
      for (const influence of [0, 1, 2, 3, 5]) {
        expect(scaledAmount(DEVELOPMENT_CRAZE_STEEL, influence), `influence ${influence}`).eq(influence);
      }
      expect(familyOf(DEVELOPMENT_CRAZE)).is.a('string');
    });

    it('the face: steel / influence on the first row; the passive drawn as a RULE — a tile on Mars → the tile\'s bonus × 2', () => {
      const [steelRow, effectRow] = DEVELOPMENT_CRAZE.renderData.rows;
      const steel = steelRow[0];
      expect(isICardRenderItem(steel) && steel.type === CardRenderItemType.STEEL, 'the steel resource').is.true;
      const influence = steelRow[2];
      expect(isICardRenderItem(influence) && influence.type === CardRenderItemType.INFLUENCE, 'per influence').is.true;
      const effect = effectRow[0];
      expect(isICardRenderEffect(effect), 'the second row is an effect frame').is.true;
      if (!isICardRenderEffect(effect)) {
        return;
      }
      const [cause, , result] = effect.rows;
      expect(isICardRenderItem(cause[0]) && cause[0].type === CardRenderItemType.EMPTY_TILE, 'the trigger: a placed tile').is.true;
      expect(isICardRenderItem(result[0]) && result[0].type === CardRenderItemType.ADJACENCY_BONUS, 'the result: the tile\'s bonus glyph').is.true;
      expect(isICardRenderItem(result[1]) && result[1].type === CardRenderItemType.TEXT && result[1].text === 'x2', '… doubled').is.true;
      const [quest] = questRenderData(DEVELOPMENT_CRAZE.quest).rows;
      expect(quest.map((n) => isICardRenderItem(n) ? n.type : 'sym')).deep.eq([CardRenderItemType.CITY, 'sym', CardRenderItemType.EMPTY_TILE_SPECIAL]);
    });
  });

  describe('the steel', () => {
    it('pays EVERY participant 1 steel per point of its OWN influence — the winner after its Agenda step — into the supply; the record and the journal line', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p1.steel).eq(2);
      expect(p2.steel).eq(3);
      expect(p1.production.steel, 'a stock gain, never production').eq(0);
      expect(outcomesOf(parliament, p1).map((o) => `${o.step}:${o.kind}`)).deep.eq(['steel:stock']);
      expect(outcomesOf(parliament, p1)[0]).deep.include({part: 'effect', effect: 'steel', stock: Resource.STEEL, amount: 2, influence: 2, before: 0, after: 2});
      const line = game.gameLog.find((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})');
      expect(line, 'one journal line with the whole calculation').is.not.undefined;
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(DEVELOPMENT_CRAZE_ID);
      expect(parliament.enacted, 'the card stands enacted — its passive is live from here').eq(CRAZE);
    });

    it('influence 0 is a NAMED skip', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 0);
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p2.steel).eq(0);
      expect(outcomesOf(parliament, p2)[0]).deep.include({kind: 'skipped', effect: 'steel', stock: Resource.STEEL, amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((entry) => entry.message === '${0} has no influence — no steel from ${1}')).is.true;
      expect(p1.steel, 'the winner (influence 1 after its step) is paid').eq(1);
    });
  });

  describe('the passive — a placement\'s bonuses paid a SECOND time while the card stands enacted', () => {
    it('a printed bonus on Mars is paid again under the resolution\'s own marker; the echo names the cell and what it repeated', () => {
      const [game, p1] = enacted();
      const cell = landWith(game, p1, [SpaceBonus.STEEL, SpaceBonus.STEEL]);
      addCity(p1, cell.id);
      runAllActions(game);
      // The enacted card's party RULES: Mars First's own passive adds its 1 steel per tile — beside the doubling, never part of it.
      expect(p1.steel, '2 printed + 2 repeated + 1 from the ruling Mars First').eq(5);
      expect(crazeMarkers(game), 'ONE trigger of the resolution').has.length(1);
      expect(crazeMarkers(game)[0].trigger).eq('tile-placed');
      expect(crazeGains(game, Resource.STEEL), 'the second payout is recorded under the marker').eq(2);
      expect(p1.lastPlacementLawPayout).deep.eq({spaceId: cell.id, resolution: DEVELOPMENT_CRAZE_ID, printed: true});
      expect(p1.lastOceanBonus, 'no ocean touched the cell').is.undefined;
      const line = game.gameLog.find((entry) => entry.message === '${0} receives the placement bonuses of the tile a second time — ${1}');
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(DEVELOPMENT_CRAZE_ID);
    });

    it('the ocean adjacency is paid again — the same breakdown the first wave rides, now in the echo', () => {
      const [game, p1] = enacted();
      const ocean = addOcean(p1);
      runAllActions(game);
      const shore = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0);
      expect(shore, 'a bare shore next to the ocean').is.not.undefined;
      p1.megaCredits = 0;
      addGreenery(p1, shore!.id);
      runAllActions(game);
      expect(p1.megaCredits, '2 M€ for the ocean, twice').eq(4);
      expect(crazeGains(game, Resource.MEGACREDITS)).eq(2);
      expect(p1.lastOceanBonus, 'the first wave\'s breakdown').deep.include({spaceId: shore!.id, megacredits: 2, perOcean: 2});
      expect(p1.lastPlacementLawPayout).deep.eq({
        spaceId: shore!.id, resolution: DEVELOPMENT_CRAZE_ID, printed: true,
        ocean: {spaceId: shore!.id, oceanSpaceIds: [ocean.id], perOcean: 2, megacredits: 2},
      });
    });

    it('a bare cell (no printed bonus, no ocean, no Ares) raises no marker, no echo and no journal line', () => {
      const [game, p1] = enacted();
      addCity(p1, bareLand(game, p1).id);
      runAllActions(game);
      expect(crazeMarkers(game)).deep.eq([]);
      expect(p1.lastPlacementLawPayout).is.undefined;
      expect(game.gameLog.some((entry) => entry.message === '${0} receives the placement bonuses of the tile a second time — ${1}')).is.false;
    });

    it('OFF MARS nothing doubles: a city on a reserved area', () => {
      const [game, p1] = enacted();
      game.addCity(p1, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY));
      runAllActions(game);
      expect(crazeMarkers(game)).deep.eq([]);
      expect(p1.lastPlacementLawPayout).is.undefined;
    });

    it('a COVER (the tile landed on an existing tile) repeats only the adjacency — the engine paid no printed bonus, so none is invented', () => {
      const [game, p1] = enacted();
      const cell = landWith(game, p1, [SpaceBonus.STEEL, SpaceBonus.STEEL]);
      game.simpleAddTile(p1, cell, {tileType: TileType.CITY});
      const before = p1.steel;
      ParliamentHandler.onTilePlaced(p1, cell, {coveringExistingTile: true});
      runAllActions(game);
      expect(p1.steel - before, 'nothing printed is repeated — only the ruling Mars First party steel').eq(1);
      expect(crazeMarkers(game)).deep.eq([]);
      expect(p1.lastPlacementLawPayout, 'no ocean either — nothing to echo').is.undefined;
      // …and told directly, the repeat reports the same honesty.
      expect(repeatPlacementBonuses(p1, cell, {coveringExistingTile: true})).is.undefined;
    });

    it('a seat WITHOUT the law is paid once: nothing enacted, or another card enacted', () => {
      const [game, p1, , parliament] = reduxGame();
      addCity(p1, landWith(game, p1, [SpaceBonus.STEEL, SpaceBonus.STEEL]).id);
      runAllActions(game);
      expect(p1.steel, 'nothing enacted').eq(2);
      parliament.enacted = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);
      addCity(p1, landWith(game, p1, [SpaceBonus.STEEL, SpaceBonus.STEEL]).id);
      runAllActions(game);
      expect(p1.steel, 'another law (Mars First rules by it: +1 party steel, no doubling)').eq(5);
      expect(crazeMarkers(game)).deep.eq([]);
    });

    it('the doubling ENDS when the law changes — the handler reads the enacted card at the hook', () => {
      const [game, p1, , parliament] = enacted();
      addCity(p1, landWith(game, p1, [SpaceBonus.STEEL, SpaceBonus.STEEL]).id);
      runAllActions(game);
      expect(p1.steel, '2 + 2 + the ruling Mars First party 1').eq(5);
      parliament.enacted = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);
      addCity(p1, landWith(game, p1, [SpaceBonus.STEEL, SpaceBonus.STEEL]).id);
      runAllActions(game);
      expect(p1.steel, 'paid once now (+2 printed, +1 party)').eq(8);
      expect(crazeMarkers(game), 'the one trigger is the old one').has.length(1);
    });

    it('a card-resource bonus asks its holder again; a card icon draws again (Arabia Terra\'s microbe ocean)', () => {
      const [game, p1] = enacted({board: BoardName.ARABIA_TERRA});
      const holder = new Tardigrades();
      p1.playedCards.push(holder);
      const cell = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.MICROBE) && s.bonus.includes(SpaceBonus.DRAW_CARD));
      expect(cell, 'the microbe ocean cell').is.not.undefined;
      const hand = p1.cardsInHand.length;
      addOcean(p1, cell!.id);
      runAllActions(game);
      expect(holder.resourceCount, '2 microbes printed, applied twice (the single holder is the engine\'s own auto-apply)').eq(4);
      expect(p1.cardsInHand.length, 'the card icon draws twice').eq(hand + 2);
      expect(crazeMarkers(game)).has.length(1);
    });

    it('a PAY-TO-USE bonus (the Hellas ocean) is offered again when affordable, and NAMED as skipped when it is not', () => {
      const [game, p1] = enacted({board: BoardName.HELLAS});
      const pole = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.OCEAN));
      expect(pole, 'the south pole').is.not.undefined;
      p1.megaCredits = 12;
      game.addCity(p1, pole!);
      runAllActions(game);
      // The first bill auto-paid (M€ only) and asks for the ocean's cell.
      const first = cast(p1.popWaitingFor(), SelectSpace);
      first.cb(first.spaces[0]);
      runAllActions(game);
      const second = cast(p1.popWaitingFor(), SelectSpace);
      second.cb(second.spaces[0]);
      runAllActions(game);
      const bills = (g: IGame) => g.events.events.filter((e) => e.source?.kind === 'payment' && (e.impact.stock?.megacredits ?? 0) === -6).length;
      expect(bills(game), 'two bills of 6 (the adjacency of the oceans may pay the seat meanwhile)').eq(2);
      expect(game.board.spaces.filter((s) => Board.isOceanSpace(s)).length, 'two oceans placed').eq(2);
      expect(game.gameLog.some((entry) => entry.message === 'The ocean placement bonus is skipped — ${0} cannot pay ${1} M€')).is.false;

      // …and short of the second bill: the second offer is skipped BY NAME, nothing throws.
      const [game2, q1] = enacted({board: BoardName.HELLAS});
      const pole2 = game2.board.spaces.find((s) => s.bonus.includes(SpaceBonus.OCEAN));
      q1.megaCredits = 6;
      game2.addCity(q1, pole2!);
      runAllActions(game2);
      const only = cast(q1.popWaitingFor(), SelectSpace);
      only.cb(only.spaces[0]);
      runAllActions(game2);
      expect(q1.getWaitingFor(), 'no second bill').is.undefined;
      expect(bills(game2), 'one bill').eq(1);
      expect(game2.board.spaces.filter((s) => Board.isOceanSpace(s)).length).eq(1);
      const skip = game2.gameLog.find((entry) => entry.message === 'The ocean placement bonus is skipped — ${0} cannot pay ${1} M€');
      expect(skip, 'the skip names itself').is.not.undefined;
      expect(skip?.data.map((d) => d.value)).deep.include.members(['6']);
    });

    it('the forecast twin: a city play lists ONE deferred fact of the resolution with no number; a play without a tile lists none; nothing while not enacted', () => {
      const [, p1, , parliament] = reduxGame();
      p1.production.add(Resource.ENERGY, 1);
      expect(resolutionFactsOf(p1, new ImmigrantCity()), 'not enacted').deep.eq([]);
      parliament.enacted = CRAZE;
      const facts = resolutionFactsOf(p1, new ImmigrantCity());
      expect(facts).has.length(1);
      const fact = facts[0];
      expect(fact.certainty).eq('deferred');
      expect(fact.timing).eq('after-placement');
      expect(fact.recipient).deep.eq({kind: 'you'});
      expect(fact.source.channel, 'the same channel the live hook fires on').eq('tile-placed');
      expect(fact.source.owner).eq(p1.color);
      expect(fact.effects, 'no number: the cell is chosen after the forecast').deep.eq([]);
      expect(fact.reason).eq('Development Craze pays the placement and adjacency bonuses of a tile you place on Mars a second time');
      expect(resolutionFactsOf(p1, new SecurityFleet())).deep.eq([]);
    });
  });

  describe('the chairman quest — place 1 city or special tile', () => {
    function placeAsAction(player: TestPlayer, place: () => void): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.IMMIGRANT_CITY, owner: player.color}, {category: 'card-play'});
      try {
        place();
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    function enactCraze(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(DEVELOPMENT_CRAZE_ID);
      return [game, p1, p2, parliament];
    }

    it('a greenery moves no progress; a city on Mars completes it at once', () => {
      const [, p1, p2, parliament] = enactCraze();
      placeAsAction(p2, () => addGreenery(p2));
      expect(parliament.questProgressOf(p2), 'a greenery is neither a city nor a special tile').eq(0);
      placeAsAction(p1, () => addCity(p1));
      expect(parliament.quest?.completedBy).eq(p1.id);
    });

    it('a special tile completes it too', () => {
      const [game, p1, , parliament] = enactCraze();
      placeAsAction(p1, () => game.addTile(p1, bareLand(game, p1), {tileType: TileType.NUCLEAR_ZONE, card: CardName.NUCLEAR_ZONE}));
      expect(parliament.quest?.completedBy).eq(p1.id);
    });
  });

  describe('MarsBot', () => {
    it('MarsBot is outside the parliament: its placement is paid once and raises no marker; the human\'s is doubled', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.phase = Phase.ACTION;
      parliament.enacted = CRAZE;
      const botCell = landWith(game, bot, [SpaceBonus.STEEL, SpaceBonus.STEEL]);
      const before = bot.megaCredits;
      game.addCity(bot, botCell);
      runAllActions(game);
      expect(bot.megaCredits - before, 'the bot\'s own icon rule, once').eq(2);
      expect(bot.steel).eq(0);
      expect(crazeMarkers(game)).deep.eq([]);
      addCity(human, landWith(game, human, [SpaceBonus.STEEL, SpaceBonus.STEEL]).id);
      runAllActions(game);
      expect(human.steel, '2 + 2 + the ruling Mars First party 1').eq(5);
      expect(crazeMarkers(game)).has.length(1);
    });
  });
});
