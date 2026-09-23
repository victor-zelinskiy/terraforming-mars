import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  FORESTRY_SUPPORT, FORESTRY_SUPPORT_ADJACENCY, FORESTRY_SUPPORT_CODE, FORESTRY_SUPPORT_ID, FORESTRY_SUPPORT_PLANTS,
  payGreeneryAdjacency,
} from '../../src/server/parliament/resolutions/greens/ForestrySupport';
import {BIODOME_CONTEST_ID, BIODOME_CONTEST_PLANTS} from '../../src/server/parliament/resolutions/greens/BiodomeContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
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
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {ICard} from '../../src/server/cards/ICard';
import {addCity, addGreenery, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * FORESTRY SUPPORT (Turmoil Redux, RX11) — plants by influence at the
 * enactment, and — while the card stands enacted — a NEW ADJACENCY the engine
 * has no notion of: every greenery beside a tile you place on Mars pays you
 * 2 M€ and 1 plant, through the board twin of the ocean-adjacency rule.
 *
 * What these specs pin: the plants by each seat's OWN influence (a named skip
 * at 0); the groves pay under the resolution's own `effect-triggered` marker
 * and publish WHICH groves paid; ANY owner's greenery pays, MarsBot's
 * included; Wetlands pays (it is a greenery AND an ocean, so it pays both
 * rules); a cell with no greenery neighbour raises nothing; off Mars nothing;
 * a COVERING placement pays (the ocean rule's own behaviour); a camp move
 * (a placement with no tile) pays nothing; a seat without the law is paid
 * nothing; the payout ENDS with the law; the forecast twin; the quest counts
 * greeneries; MarsBot is never paid.
 */
const FORESTRY = resolutionInstanceId(FORESTRY_SUPPORT_ID, 0);
const RATE = FORESTRY_SUPPORT_ADJACENCY;

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, FORESTRY);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The card ENACTED without a sitting — the passive alone is under test. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  parliament.enacted = FORESTRY;
  return [game, p1, p2, parliament];
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomesOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

/** The resolution's `effect-triggered` markers in the stream. */
function lawMarkers(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution' && e.source.id === FORESTRY_SUPPORT_ID);
}

/** The resource deltas recorded UNDER the law's markers. */
function lawGains(game: IGame, resource: Resource): number {
  const markers = new Set(lawMarkers(game).map((m) => m.id));
  return game.events.events
    .filter((e) => e.type === 'resource-changed' && e.parentId !== undefined && markers.has(e.parentId))
    .reduce((sum, e) => sum + (e.impact.stock?.[resource] ?? 0), 0);
}

/**
 * A QUIET CITY CELL WITH `groves` GREENERY NEIGHBOURS. The cell prints no
 * bonus and touches no ocean, so the only money a placement there can make is
 * the law's; the greeneries are seated with `simpleAddTile` (no bonuses, no
 * hooks — the board is ARRANGED, not played).
 */
function cellWithGroves(game: IGame, player: IPlayer, groves: Array<IPlayer | undefined>): Space {
  const candidate = game.board.getAvailableSpacesOnLand(player).find((s) =>
    s.bonus.length === 0 &&
    !game.board.getAdjacentSpaces(s).some((a) => Board.isOceanSpace(a)) &&
    game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).length >= groves.length);
  if (candidate === undefined) {
    throw new Error(`no quiet land cell with ${groves.length} free land neighbours`);
  }
  const free = game.board.getAdjacentSpaces(candidate).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined);
  groves.forEach((owner, i) => {
    game.simpleAddTile(owner ?? player, free[i], {tileType: TileType.GREENERY});
  });
  return candidate;
}

function resolutionFactsOf(player: IPlayer, card: ICard) {
  const forecast = effectForecastForPlay(player, card, cardPlayPreview(player, card));
  return allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution' && f.source.name === FORESTRY_SUPPORT_ID);
}

describe('ForestrySupport', () => {
  describe('the catalog entry', () => {
    it('is RX11 of the Greens, ONE card: plants by influence for everyone, a LIVE passive with both twins, the two-greeneries quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(FORESTRY_SUPPORT_ID)).eq(FORESTRY_SUPPORT);
      expect(FORESTRY_SUPPORT_CODE).eq('RX11');
      expect(FORESTRY_SUPPORT_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX11')).eq(FORESTRY_SUPPORT);
      expect(FORESTRY_SUPPORT.party).eq(PartyName.GREENS);
      expect(FORESTRY_SUPPORT.compatibility, 'a base card').is.undefined;
      expect(FORESTRY_SUPPORT.quest).deep.eq({goal: {kind: 'tile', tile: 'greenery'}, count: 2});
      expect(FORESTRY_SUPPORT.winnerSteps, 'no winner-only part').is.undefined;
      expect(typeof FORESTRY_SUPPORT.passive?.forecast, 'the honesty law: a passive declares its forecast').eq('function');
      expect(typeof FORESTRY_SUPPORT.passive?.placementFacts, 'a TILE passive declares its dossier twin').eq('function');
      expect(FORESTRY_SUPPORT.text.passive).is.a('string').and.not.empty;
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === FORESTRY)).has.length(1);
      expect(familyOf(FORESTRY_SUPPORT)).is.a('string');
    });

    it('the immediate part is Biodome Contest\'s declaration verbatim (2 plants per influence, no cap) and its very sentence', () => {
      expect(FORESTRY_SUPPORT.scaled).deep.eq([FORESTRY_SUPPORT_PLANTS]);
      expect(FORESTRY_SUPPORT_PLANTS.unit).deep.eq(BIODOME_CONTEST_PLANTS.unit);
      expect(FORESTRY_SUPPORT_PLANTS.perInfluence).eq(BIODOME_CONTEST_PLANTS.perInfluence);
      expect(FORESTRY_SUPPORT_PLANTS.recipient).eq(BIODOME_CONTEST_PLANTS.recipient);
      expect(FORESTRY_SUPPORT_PLANTS.cap, 'no cap').is.undefined;
      const biodome = REDUX_RESOLUTION_CATALOG.getOrThrow(BIODOME_CONTEST_ID);
      expect(FORESTRY_SUPPORT.text.effect, 'one sentence, one i18n key').eq(biodome.text.effect);
      for (const influence of [0, 1, 2, 3, 5]) {
        expect(scaledAmount(FORESTRY_SUPPORT_PLANTS, influence), `influence ${influence}`).eq(influence * 2);
      }
    });

    it('the face: plants / influence, then the passive as a RULE — a tile beside a greenery pays 2 M€ and a plant', () => {
      const [plantsRow, effectRow] = FORESTRY_SUPPORT.renderData.rows;
      const plants = plantsRow[0];
      expect(isICardRenderItem(plants) && plants.type === CardRenderItemType.PLANTS && plants.amount === 2).is.true;
      const influence = plantsRow[2];
      expect(isICardRenderItem(influence) && influence.type === CardRenderItemType.INFLUENCE).is.true;
      const effect = effectRow[0];
      expect(isICardRenderEffect(effect)).is.true;
      if (!isICardRenderEffect(effect)) {
        return;
      }
      const [cause, , result] = effect.rows;
      expect(cause.map((n) => isICardRenderItem(n) ? n.type : 'other'), 'the trigger: a tile placed BESIDE a greenery')
        .deep.eq([CardRenderItemType.EMPTY_TILE, CardRenderItemType.GREENERY]);
      expect(isICardRenderItem(result[0]) && result[0].type === CardRenderItemType.MEGACREDITS && result[0].amount === RATE.megacredits).is.true;
      expect(isICardRenderItem(result[1]) && result[1].type === CardRenderItemType.PLANTS && result[1].amount === RATE.plants).is.true;
      const [quest] = questRenderData(FORESTRY_SUPPORT.quest).rows;
      expect(quest.filter((n) => isICardRenderItem(n) && n.type === CardRenderItemType.GREENERY), 'two greeneries').has.length(2);
    });
  });

  describe('the plants', () => {
    it('pays EVERY participant 2 plants per point of its OWN influence — the winner after its Agenda step; the record and the journal line', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p1.plants).eq(4);
      expect(p2.plants).eq(6);
      expect(p1.production.plants, 'a stock gain, never production').eq(0);
      expect(outcomesOf(parliament, p1).map((o) => `${o.step}:${o.kind}`)).deep.eq(['plants:stock']);
      expect(outcomesOf(parliament, p1)[0]).deep.include({part: 'effect', effect: 'plants', stock: Resource.PLANTS, amount: 4, influence: 2, before: 0, after: 4});
      const line = game.gameLog.find((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: 2 per point of influence, influence ${4} (${5} → ${6})');
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(FORESTRY_SUPPORT_ID);
      expect(parliament.enacted, 'the card stands enacted — its passive is live from here').eq(FORESTRY);
    });

    it('influence 0 is a NAMED skip', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 0);
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p2.plants).eq(0);
      expect(outcomesOf(parliament, p2)[0]).deep.include({kind: 'skipped', effect: 'plants', stock: Resource.PLANTS, amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((entry) => entry.message === '${0} has no influence — no plants from ${1}')).is.true;
      expect(p1.plants, 'the winner (influence 1 after its step) is paid').eq(2);
    });
  });

  describe('the passive — the groves pay their neighbours while the card stands enacted', () => {
    it('TWO adjacent greeneries pay 2 M€ + 1 plant each, under the law\'s own marker; the record names both groves and the rate', () => {
      const [game, p1, p2] = enacted();
      const cell = cellWithGroves(game, p1, [p1, p2]);
      const groves = game.board.getAdjacentSpaces(cell).filter(Board.isGreenerySpace).map((s) => s.id);
      p1.megaCredits = 0;
      addCity(p1, cell.id);
      runAllActions(game);
      expect(p1.megaCredits, '2 groves × 2 M€').eq(2 * RATE.megacredits);
      expect(p1.plants, '2 groves × 1 plant').eq(2 * RATE.plants);
      expect(lawMarkers(game), 'ONE trigger of the law').has.length(1);
      expect(lawMarkers(game)[0].trigger).eq('tile-placed');
      expect(lawGains(game, Resource.MEGACREDITS)).eq(4);
      expect(lawGains(game, Resource.PLANTS)).eq(2);
      expect(p1.lastPlacementLawPayout).deep.eq({
        spaceId: cell.id,
        resolution: FORESTRY_SUPPORT_ID,
        greeneries: {spaceId: cell.id, greenerySpaceIds: groves, perGreenery: RATE, megacredits: 4, plants: 2},
      });
      const line = game.gameLog.find((entry) => entry.message === '${0} gained ${1} ${2} and ${3} ${4} for ${6} adjacent greenery(-ies) — ${5}');
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(FORESTRY_SUPPORT_ID);
    });

    it('ANY owner\'s greenery pays — a rival\'s grove is worth exactly its own', () => {
      const [game, p1, p2] = enacted();
      const cell = cellWithGroves(game, p1, [p2]);
      p1.megaCredits = 0;
      addCity(p1, cell.id);
      runAllActions(game);
      expect(p1.megaCredits).eq(RATE.megacredits);
      expect(p1.plants).eq(RATE.plants);
    });

    it('WETLANDS pays too — it is a greenery AND an ocean, so both adjacency rules answer', () => {
      const [game, p1] = enacted();
      const cell = cellWithGroves(game, p1, [p1]);
      const grove = game.board.getAdjacentSpaces(cell).find(Board.isGreenerySpace)!;
      grove.tile = {tileType: TileType.WETLANDS, card: CardName.WETLANDS};
      expect(Board.isGreenerySpace(grove) && Board.isOceanSpace(grove), 'the fixture is the double tile').is.true;
      p1.megaCredits = 0;
      addCity(p1, cell.id);
      runAllActions(game);
      expect(p1.plants, 'the law').eq(RATE.plants);
      expect(p1.megaCredits, 'the law\'s 2 M€ + the engine\'s own ocean adjacency 2 M€').eq(RATE.megacredits + p1.oceanBonus);
      expect(lawGains(game, Resource.MEGACREDITS), 'only the law\'s share rides its marker').eq(RATE.megacredits);
    });

    it('a cell with NO greenery neighbour raises no marker, no record and no journal line', () => {
      const [game, p1] = enacted();
      const cell = cellWithGroves(game, p1, []);
      addCity(p1, cell.id);
      runAllActions(game);
      expect(lawMarkers(game)).deep.eq([]);
      expect(p1.lastPlacementLawPayout).is.undefined;
      expect(game.gameLog.some((entry) => entry.message === '${0} gained ${1} ${2} and ${3} ${4} for ${6} adjacent greenery(-ies) — ${5}')).is.false;
    });

    it('OFF MARS nothing pays: a reserved area has no neighbours', () => {
      const [game, p1] = enacted();
      game.addCity(p1, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY));
      runAllActions(game);
      expect(lawMarkers(game)).deep.eq([]);
      expect(p1.lastPlacementLawPayout).is.undefined;
    });

    it('a COVERING placement pays — the engine grants the ocean adjacency on a cover, and the twin mirrors it', () => {
      const [game, p1] = enacted();
      const cell = cellWithGroves(game, p1, [p1]);
      game.simpleAddTile(p1, cell, {tileType: TileType.CITY});
      p1.megaCredits = 0;
      p1.plants = 0;
      // The engine's own covering path: the printed bonuses are skipped, the adjacency is not.
      game.grantPlacementBonuses(p1, cell, true);
      runAllActions(game);
      expect(p1.megaCredits).eq(RATE.megacredits);
      expect(p1.plants).eq(RATE.plants);
    });

    it('a placement with NO TILE (a Mars Nomads camp move) pays nothing — a move is not a placement', () => {
      const [game, p1] = enacted();
      const cell = cellWithGroves(game, p1, [p1]);
      p1.megaCredits = 0;
      p1.plants = 0;
      // The camp move's own engine path: the cell's bonuses without a tile on it.
      game.grantPlacementBonuses(p1, cell);
      runAllActions(game);
      expect(p1.megaCredits).eq(0);
      expect(p1.plants).eq(0);
      expect(lawMarkers(game)).deep.eq([]);
    });

    it('a seat WITHOUT the law is paid nothing, and the payout ENDS when the law changes', () => {
      const [game, p1, , parliament] = reduxGame();
      const first = cellWithGroves(game, p1, [p1]);
      p1.megaCredits = 0;
      addCity(p1, first.id);
      runAllActions(game);
      expect(p1.megaCredits, 'nothing enacted').eq(0);
      expect(p1.plants).eq(0);

      parliament.enacted = FORESTRY;
      const second = cellWithGroves(game, p1, [p1]);
      addCity(p1, second.id);
      runAllActions(game);
      expect(p1.megaCredits).eq(RATE.megacredits);
      expect(lawMarkers(game)).has.length(1);

      parliament.enacted = resolutionInstanceId(BIODOME_CONTEST_ID, 0);
      const third = cellWithGroves(game, p1, [p1]);
      addCity(p1, third.id);
      runAllActions(game);
      expect(p1.megaCredits, 'another law pays nothing of this one').eq(RATE.megacredits);
      expect(lawMarkers(game), 'the one marker is the old one').has.length(1);
    });

    it('the payout is the BOARD twin\'s own arithmetic — the same call the dossier and the specs read', () => {
      const [game, p1] = enacted();
      const cell = cellWithGroves(game, p1, [p1, p1]);
      const read = game.board.greeneryAdjacencyBonus(cell, RATE);
      expect(read.greeneries).eq(2);
      expect(read.megacredits).eq(4);
      expect(read.plants).eq(2);
      expect(read.spaceIds).deep.eq(game.board.getAdjacentSpaces(cell).filter(Board.isGreenerySpace).map((s) => s.id));
      p1.megaCredits = 0;
      p1.plants = 0;
      const paid = payGreeneryAdjacency(p1, cell)!;
      expect(paid.megacredits).eq(read.megacredits);
      expect(paid.plants).eq(read.plants);
      expect(p1.megaCredits).eq(read.megacredits);
      expect(p1.plants).eq(read.plants);
    });

    it('the forecast twin: a play that puts a tile on Mars lists ONE deferred fact with no number; a play without a tile lists none; nothing while not enacted', () => {
      const [, p1, , parliament] = reduxGame();
      p1.production.add(Resource.ENERGY, 1);
      expect(resolutionFactsOf(p1, new ImmigrantCity()), 'not enacted').deep.eq([]);
      parliament.enacted = FORESTRY;
      const facts = resolutionFactsOf(p1, new ImmigrantCity());
      expect(facts).has.length(1);
      expect(facts[0].certainty).eq('deferred');
      expect(facts[0].timing).eq('after-placement');
      expect(facts[0].source.channel, 'the channel the live hook fires on').eq('tile-placed');
      expect(facts[0].effects, 'no number: the cell is chosen after the forecast').deep.eq([]);
      expect(facts[0].reason).eq('Forestry Support pays 2 M€ and 1 plant for every greenery next to a tile you place on Mars');
      expect(resolutionFactsOf(p1, new SecurityFleet())).deep.eq([]);
    });
  });

  describe('the chairman quest — place 2 greeneries', () => {
    it('two greeneries the player places as its own actions complete it; the enactment itself moves nothing', () => {
      const [game, p1, , parliament] = stage();
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(FORESTRY_SUPPORT_ID);
      expect(parliament.questProgressOf(p1), 'the enactment is not a placement').eq(0);
      const place = () => {
        const events = game.events;
        events.beginAction(p1, {kind: 'card', card: CardName.IMMIGRANT_CITY, owner: p1.color}, {category: 'card-play'});
        try {
          addGreenery(p1);
        } finally {
          events.endScope();
        }
        runAllActions(game);
      };
      place();
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest?.completedBy).is.undefined;
      place();
      expect(parliament.quest?.completedBy).eq(p1.id);
    });
  });

  describe('MarsBot', () => {
    it('MarsBot is outside the parliament: its own placement pays it nothing, and its grove still pays the human', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.phase = Phase.ACTION;
      parliament.enacted = FORESTRY;
      const botCell = cellWithGroves(game, bot, [bot]);
      const botBefore = bot.megaCredits;
      game.addCity(bot, botCell);
      runAllActions(game);
      expect(bot.megaCredits - botBefore, 'the bot holds no law').eq(0);
      expect(bot.plants).eq(0);
      expect(lawMarkers(game)).deep.eq([]);

      const cell = cellWithGroves(game, human, [bot]);
      human.megaCredits = 0;
      addCity(human, cell.id);
      runAllActions(game);
      expect(human.megaCredits, 'the bot\'s grove pays the human').eq(RATE.megacredits);
      expect(human.plants).eq(RATE.plants);
    });
  });
});
