import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentPhase} from '../../src/server/parliament/ParliamentPhase';
import {
  BIODOME_CONTEST, BIODOME_CONTEST_CODE, BIODOME_CONTEST_ID, BIODOME_CONTEST_PLANTS,
} from '../../src/server/parliament/resolutions/greens/BiodomeContest';
import {AQUIFER_CONTEST, AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {ARCHITECTURE_AWARD, ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, answerGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {REDUX_GREENERY_TILE_TR, winnerParameterRoom, winnerRewardTr, WinnerTileReward} from '../../src/common/parliament/winnerReward';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {Space} from '../../src/server/boards/Space';
import {cast} from '../../src/common/utils/utils';
import {addOcean, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {Cloner} from '../../src/server/database/Cloner';
import {PlayerId} from '../../src/common/Types';

/**
 * BIODOME CONTEST (Turmoil Redux, RX03) — «a reward for everyone by influence
 * + the winner's own tile with all its consequences». What these specs pin:
 * every participant gains 2 plants per point of THEIR influence (no cap, the
 * winner's Agenda step first, a zero named), the winner places ONE greenery
 * through the standard placement (the general validator's cells, one oxygen
 * step — the tile's own —, the greenery revision's TR, the Greens already
 * ruling and paying for the TR that lands, the cell's bonuses, the threshold
 * chain, nothing spent), a maxed oxygen still takes the tile, no legal cell
 * is named and skipped, a neutral winner places nothing, the resolution's
 * greenery never advances the «place 2 greeneries» quest while the player's
 * own ones do, and no reload / repeated answer / re-entry pays anything twice.
 */
const BIODOME = resolutionInstanceId(BIODOME_CONTEST_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/**
 * Seat Biodome Contest in slot 0 with p1's delegate on it (p1 wins it), the
 * rest of the area on other parties (the seating keeps it distinct), and Mars
 * First ruling BEFORE the enactment — so the Greens' presence at the effect is
 * the enactment's own doing.
 */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, BIODOME);
  seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/**
 * Every player passes; production → the parliament; the sitting's ASSEMBLY
 * gate is answered for every seat (the harness's stale menus cleared first),
 * so the resolution's own asks stand — or, for a quiet card, the ADJOURN gate
 * is answered too and the phase is over (`parliamentArrange`).
 */
function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: string) {
  const outcomes = parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? [];
  return outcomes.find((o) => o.player === player.id && o.step === step);
}

/** A cell with nothing of its own: no printed bonus, no ocean beside it — the placement's pure effect. */
function quietCell(game: IGame, ask: SelectSpace): Space {
  const space = ask.spaces.find((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile?.tileType === TileType.OCEAN));
  if (space === undefined) {
    throw new Error('no quiet cell');
  }
  return space;
}

function greeneries(game: IGame): number {
  return game.board.spaces.filter((s) => s.tile?.tileType === TileType.GREENERY).length;
}

describe('BiodomeContest', () => {
  describe('the catalog entry', () => {
    it('is RX03 of the Greens, dealt as ONE card', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(BIODOME_CONTEST_ID)).eq(BIODOME_CONTEST);
      expect(BIODOME_CONTEST_CODE).eq('RX03');
      expect(BIODOME_CONTEST_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX03')).eq(BIODOME_CONTEST);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX01')).eq(AQUIFER_CONTEST);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX02')).eq(ARCHITECTURE_AWARD);
      expect(BIODOME_CONTEST.party).eq(PartyName.GREENS);
      expect(BIODOME_CONTEST.quest).deep.eq({goal: {kind: 'tile', tile: 'greenery'}, count: 2});
      expect(BIODOME_CONTEST.scaled).deep.eq([BIODOME_CONTEST_PLANTS]);
      expect(BIODOME_CONTEST.winnerReward).deep.eq({kind: 'tile', tile: 'greenery'});
      expect(BIODOME_CONTEST.winnerSteps).has.length(1);
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt).includes(BIODOME);
      // The Greens' share of the deck is however many of THEIR resolutions are
      // implemented — the prototype's «two per party» was never a rule.
      expect(dealt.filter((instance) => REDUX_RESOLUTION_CATALOG.ofInstance(instance).party === PartyName.GREENS).sort())
        .deep.eq(REDUX_RESOLUTION_CATALOG.all()
          .filter((r) => r.party === PartyName.GREENS && r.copies > 0)
          .map((r) => resolutionInstanceId(r.id, 0)).sort());
      expect(dealt).includes(resolutionInstanceId(AQUIFER_CONTEST_ID, 0));
      expect(dealt.filter((instance) => instance === BIODOME), 'one physical copy').has.length(1);
      const codes = REDUX_RESOLUTION_CATALOG.all().map((r) => r.code).filter((c): c is string => c !== undefined);
      expect(new Set(codes).size).eq(codes.length);
    });

    it('the shared formula: 2 plants per point of influence — NO cap, nothing below zero', () => {
      const cases: Array<[number, number]> = [[0, 0], [1, 2], [2, 4], [3, 6], [5, 10], [7, 14]];
      for (const [influence, plants] of cases) {
        expect(scaledAmount(BIODOME_CONTEST_PLANTS, influence), `influence ${influence}`).eq(plants);
      }
      expect(scaledAmount(BIODOME_CONTEST_PLANTS, -2)).eq(0);
      expect(BIODOME_CONTEST_PLANTS.cap, 'Architecture Award\'s max 5 is not carried over').is.undefined;
      expect(BIODOME_CONTEST_PLANTS.unit).deep.eq({kind: 'stock', resource: Resource.PLANTS});
      expect(BIODOME_CONTEST_PLANTS.recipient).eq('each');
    });

    it('the winner reward as data: one greenery, ONE oxygen step (none at the maximum), the tile\'s own TR always', () => {
      const reward = BIODOME_CONTEST.winnerReward as WinnerTileReward;
      const low = winnerParameterRoom(reward, {oxygenLevel: 5, temperature: -30, oceans: 0});
      expect(low).deep.include({parameter: 'oxygen', current: 5, resulting: 6, rises: true, tileAvailable: true, temperatureBonus: false});
      expect(winnerRewardTr(reward, low)).deep.eq({tile: REDUX_GREENERY_TILE_TR, parameter: 1, temperature: 0});
      const threshold = winnerParameterRoom(reward, {oxygenLevel: 7, temperature: -30, oceans: 0});
      expect(threshold.temperatureBonus, '7 → 8 % raises the temperature').is.true;
      expect(winnerRewardTr(reward, threshold)).deep.eq({tile: 1, parameter: 1, temperature: 1});
      const max = winnerParameterRoom(reward, {oxygenLevel: MAX_OXYGEN_LEVEL, temperature: MAX_TEMPERATURE, oceans: 0});
      expect(max).deep.include({rises: false, resulting: MAX_OXYGEN_LEVEL, tileAvailable: true, temperatureBonus: false});
      expect(winnerRewardTr(reward, max)).deep.eq({tile: 1, parameter: 0, temperature: 0});
      // Aquifer's ocean reads the same way: no ocean left = no tile at all.
      const aquifer = AQUIFER_CONTEST.winnerReward as WinnerTileReward;
      const ocean = winnerParameterRoom(aquifer, {oxygenLevel: 0, temperature: -30, oceans: 9});
      expect(ocean).deep.include({parameter: 'oceans', rises: false, tileAvailable: false});
      expect(winnerRewardTr(aquifer, ocean)).deep.eq({tile: 0, parameter: 0, temperature: 0});
    });
  });

  describe('the plants payout', () => {
    it('pays every participant 2 × THEIR influence into the supply — the winner after its Agenda step, a non-voter by its own track, the winner once', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner) at the start: the phase's Agenda step → step 1 = influence 1.
      // p2 never voted, step 5 = influence 3.
      parliament.agenda.set(p2.id, 5);
      p1.plants = 1;
      p2.plants = 4;
      endGeneration(game);
      expect(game.phase).eq(Phase.PARLIAMENT);
      // The winner's own plants land BEFORE its greenery is asked; p2 waits.
      cast(p1.getWaitingFor(), SelectSpace);
      expect(p1.plants).eq(1 + 2);
      expect(p2.plants, 'p2 is visited after the winner\'s greenery').eq(4);
      expect(outcomeOf(parliament, p1, 'plants')).deep.eq({
        player: p1.id, step: 'plants', part: 'effect', effect: 'plants', kind: 'stock', stock: Resource.PLANTS, amount: 2, influence: 1, before: 1, after: 3,
      });
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p2.plants).eq(4 + 6);
      expect(p1.plants, 'the winner is paid once — the greenery spends none').eq(3);
      expect(outcomeOf(parliament, p2, 'plants')).deep.include({kind: 'stock', amount: 6, influence: 3, before: 4, after: 10});
      // Plants, never production: nothing moved on the production board.
      expect(p1.production.plants).eq(0);
      expect(p2.production.plants).eq(0);
    });

    it('no cap: influence beyond the track counts in full (5 on the track + 2 from cards = 14 plants)', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 12);
      parliament.addInfluenceBonus(p2, 2);
      expect(parliament.influence(p2)).eq(7);
      endGeneration(game);
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      expect(p2.plants).eq(14);
      expect(outcomeOf(parliament, p2, 'plants')).deep.include({amount: 14, influence: 7});
    });

    it('influence 0 asks nothing, names itself in the journal and records a skipped outcome', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p2.plants).eq(0);
      expect(outcomeOf(parliament, p2, 'plants')).deep.include({kind: 'skipped', reason: 'No influence', amount: 0, influence: 0, stock: Resource.PLANTS});
      const line = game.gameLog.filter((entry) => entry.message === '${0} has no influence — no plants from ${1}');
      expect(line).has.length(1);
      expect(line[0].data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(BIODOME_CONTEST_ID);
    });

    it('the winner\'s Agenda step changes its influence BEFORE the payout (step 2 → 3: influence 1 → 2 = 4 plants)', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      expect(parliament.influence(p1)).eq(1);
      endGeneration(game);
      expect(parliament.agendaOf(p1)).eq(3);
      cast(p1.getWaitingFor(), SelectSpace);
      expect(p1.plants).eq(4);
      expect(outcomeOf(parliament, p1, 'plants')).deep.include({amount: 4, influence: 2});
    });

    it('the plants are a supply gain: no Greens production reaction, never converted into a greenery by themselves', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 8); // influence 4 → 8 plants: enough for a greenery, still just plants
      endGeneration(game);
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      expect(p2.plants).eq(8);
      expect(p2.production.megacredits, 'plants in the supply are not a plant-production step').eq(0);
      expect(greeneries(game), 'only the winner\'s greenery is on Mars').eq(1);
    });

    it('the journal carries ONE line per player with the calculation and the resolution as its source; the recorder sees the plants under it', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 5);
      p2.plants = 2;
      endGeneration(game);
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      const lines = game.gameLog.filter((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: 2 per point of influence, influence ${4} (${5} → ${6})');
      expect(lines).has.length(2);
      const p2Line = lines[1];
      expect(p2Line.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(BIODOME_CONTEST_ID);
      expect(p2Line.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['6', '3', '2', '8']);
      const deltas = game.events.events.filter((e) => e.type === 'resource-changed' && e.player === p2.color &&
        e.source?.kind === 'resolution' && e.source.id === BIODOME_CONTEST_ID);
      expect(deltas).has.length(1);
      expect(deltas[0].impact?.stock?.plants).eq(6);
      expect(deltas[0].impact?.snapshot).deep.include({before: 2, after: 8});
      expect(game.gameLog.some((entry) => entry.message === 'Resolution ${0} is enacted')).is.true;
      expect(game.gameLog.some((entry) => entry.message === '${0} is the winning player of ${1}')).is.true;
    });
  });

  describe('the winner\'s greenery', () => {
    it('is the standard placement: the validator\'s cells, the resolution as the source, one oxygen step, +2 TR, the Greens\' +4 M€ — nothing spent, no action', () => {
      const [game, p1, , parliament] = stage();
      setOxygenLevel(game, 3);
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      // The GENERAL validator decides the cells (never «any free cell»).
      const legal = game.board.filterSpacesAroundRedCity(game.board.getAvailableSpacesForType(p1, 'greenery'));
      expect(ask.spaces.map((s) => s.id).sort()).deep.eq(legal.map((s) => s.id).sort());
      expect(ask.placementContext?.source).deep.eq({kind: 'resolution', resolution: BIODOME_CONTEST_ID});
      expect(ask.placementContext?.cancellable).is.false;
      // Biodome Contest is enacted BEFORE its effect: the Greens rule now (Mars First did before).
      expect(parliament.enacted).eq(BIODOME);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      const tr = p1.terraformRating;
      const mc = p1.megaCredits;
      const plants = p1.plants;
      const actions = p1.actionsTakenThisGame;
      const space = quietCell(game, ask);
      p1.process({type: 'space', spaceId: space.id});
      runAllActions(game);
      expect(space.tile?.tileType).eq(TileType.GREENERY);
      expect(space.player?.id).eq(p1.id);
      expect(game.getOxygenLevel(), 'ONE step — the tile\'s own raise').eq(4);
      expect(p1.terraformRating, '+1 for the tile (Redux) + 1 for the oxygen').eq(tr + 2);
      expect(p1.megaCredits, 'the Greens pay 2 M€ per TR step — no standard-project cost').eq(mc + 4);
      expect(p1.plants, 'no plants spent').eq(plants);
      expect(p1.actionsTakenThisGame).eq(actions);
      expect(greeneries(game)).eq(1);
      expect(outcomeOf(parliament, p1, 'greenery')).deep.eq({
        player: p1.id, step: 'greenery', part: 'winner', kind: 'greenery', space: space.id, parameter: {id: 'oxygen', before: 3, after: 4},
      });
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });

    it('with oxygen at its maximum the greenery still lands: oxygen stays, +1 TR for the tile, the Greens\' +2 M€', () => {
      const [game, p1, , parliament] = stage();
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const tr = p1.terraformRating;
      const mc = p1.megaCredits;
      const space = quietCell(game, ask);
      p1.process({type: 'space', spaceId: space.id});
      runAllActions(game);
      expect(space.tile?.tileType).eq(TileType.GREENERY);
      expect(game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      expect(p1.terraformRating).eq(tr + 1);
      expect(p1.megaCredits).eq(mc + 2);
      expect(outcomeOf(parliament, p1, 'greenery')?.parameter).deep.eq({id: 'oxygen', before: MAX_OXYGEN_LEVEL, after: MAX_OXYGEN_LEVEL});
    });

    it('the 8 % oxygen step raises the temperature through the ordinary chain: +3 TR, +6 M€ from the Greens', () => {
      const [game, p1] = stage();
      setOxygenLevel(game, 7);
      setTemperature(game, -10);
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const tr = p1.terraformRating;
      const mc = p1.megaCredits;
      p1.process({type: 'space', spaceId: quietCell(game, ask).id});
      runAllActions(game);
      expect(game.getOxygenLevel()).eq(8);
      expect(game.getTemperature()).eq(-8);
      expect(p1.terraformRating).eq(tr + 3);
      expect(p1.megaCredits).eq(mc + 6);
    });

    it('a threshold ocean (0 °C) is the standard follow-up: the phase waits for it before visiting the next player', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 1);
      setOxygenLevel(game, 7);
      setTemperature(game, -2);
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const tr = p1.terraformRating;
      p1.process({type: 'space', spaceId: quietCell(game, ask).id});
      // The ocean from the temperature step comes next — for p1, before p2's plants.
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      expect(ocean.spaces.every((s) => s.spaceType === SpaceType.OCEAN || game.board.getAvailableSpacesForOcean(p1).includes(s))).is.true;
      expect(p2.plants, 'p2 waits for the cascade').eq(0);
      expect(parliament.phase?.step).eq('effects');
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      expect(game.board.getOceanSpaces()).has.length(1);
      // tile 1 + oxygen 1 + temperature 1 + ocean 1
      expect(p1.terraformRating).eq(tr + 4);
      expect(p2.plants).eq(2);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
    });

    it('the cell\'s printed bonuses and the ocean adjacency pay through the standard placement', () => {
      const [game, p1] = stage();
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const bonusCell = ask.spaces.find((s) => s.bonus.includes(SpaceBonus.PLANT) || s.bonus.includes(SpaceBonus.STEEL));
      expect(bonusCell, 'Tharsis has a plant / steel cell').is.not.undefined;
      const plantBonus = bonusCell!.bonus.filter((b) => b === SpaceBonus.PLANT).length;
      const steelBonus = bonusCell!.bonus.filter((b) => b === SpaceBonus.STEEL).length;
      const plants = p1.plants;
      const steel = p1.steel;
      p1.process({type: 'space', spaceId: bonusCell!.id});
      runAllActions(game);
      expect(p1.plants).eq(plants + plantBonus);
      expect(p1.steel).eq(steel + steelBonus);
    });

    it('an ocean beside the chosen cell pays its 2 M€ on top of the Greens\' TR money', () => {
      const [game, p1, p2] = stage();
      const oceanSpace = addOcean(p2);
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const beside = ask.spaces.find((s) => s.bonus.length === 0 && game.board.getAdjacentSpaces(s).some((a) => a.id === oceanSpace.id));
      expect(beside, 'a quiet cell beside the ocean').is.not.undefined;
      const mc = p1.megaCredits;
      const tr = p1.terraformRating;
      p1.process({type: 'space', spaceId: beside!.id});
      runAllActions(game);
      expect(p1.terraformRating).eq(tr + 2);
      expect(p1.megaCredits).eq(mc + 2 + 4);
    });

    it('a party effect held by delegates on a LOSING card still reacts: Mars First pays its steel for the greenery (the delegates stay until the refresh)', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BIODOME);
      seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      p1.megaCredits = 20;
      endGeneration(game);
      expect(parliament.phase?.summary?.winner).deep.include({instance: BIODOME, player: p1.id});
      expect(parliament.access(p1, PartyName.MARS).byDelegates, 'the losing Mars First card keeps p1\'s two delegates').is.true;
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const steel = p1.steel;
      p1.process({type: 'space', spaceId: quietCell(game, ask).id});
      expect(p1.steel, 'Mars First\'s 1 steel per tile placed on Mars').eq(steel + 1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p2.steel).eq(0);
    });

    it('a neutral winner places no greenery; the plants still reach every participant', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BIODOME);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, 1);
      parliament.agenda.set(p2.id, 3);
      const oxygen = game.getOxygenLevel();
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(p1.plants).eq(2);
      expect(p2.plants).eq(4);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.step === 'greenery'), 'no greenery step for a neutral winner').is.false;
      expect(greeneries(game)).eq(0);
      expect(game.getOxygenLevel()).eq(oxygen);
    });

    it('no legal cell: the part is named and skipped — no prompt, no oxygen step, no substitute; the plants stand and the phase goes on', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 1);
      // Every land cell is taken by someone else's tile.
      for (const space of game.board.getSpaces(SpaceType.LAND)) {
        if (space.tile === undefined) {
          space.tile = {tileType: TileType.NATURAL_PRESERVE};
          space.player = p2;
        }
      }
      expect(game.board.getAvailableSpacesForType(p1, 'greenery')).has.length(0);
      const oxygen = game.getOxygenLevel();
      endGeneration(game);
      expect(p1.getWaitingFor(), 'no empty placement is asked').is.not.instanceOf(SelectSpace);
      const skipped = outcomeOf(parliament, p1, 'greenery');
      expect(skipped).deep.eq({player: p1.id, step: 'greenery', part: 'winner', kind: 'skipped', reason: 'No space can take a greenery'});
      expect(game.getOxygenLevel(), 'no oxygen step without the tile').eq(oxygen);
      expect(p1.plants).eq(2);
      expect(p2.plants).eq(2);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      const line = game.gameLog.filter((entry) => entry.message === 'No space can take a greenery — the winner\'s greenery from ${0} is skipped');
      expect(line).has.length(1);
    });

    it('every other seat reads WHO is placing and WHAT kind of answer; the outcomes ride the model with colours', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 3);
      setOxygenLevel(game, 5);
      endGeneration(game);
      const phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.step).eq('effects');
      expect(phase?.pending).deep.eq({player: p1.color, key: 'greenery', input: 'space'});
      expect(phase?.outcomes).deep.eq([
        {player: p1.color, step: 'plants', part: 'effect', effect: 'plants', kind: 'stock', stock: Resource.PLANTS, amount: 2, influence: 1, before: 0, after: 2},
      ]);
      const space = quietCell(game, cast(p1.getWaitingFor(), SelectSpace));
      p1.process({type: 'space', spaceId: space.id});
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      // …and the ruling Greens' answer to the greenery's TR rides the greenery's step as its own `reaction` record.
      expect(last?.outcomes?.map((o) => `${o.player}:${o.step}:${o.kind}`)).deep.eq([
        `${p1.color}:plants:stock`, `${p1.color}:greenery:greenery`, `${p1.color}:greenery:reaction`, `${p2.color}:plants:stock`,
      ]);
      expect(last?.outcomes?.[1]).deep.include({space: space.id, parameter: {id: 'oxygen', before: 5, after: 6}});
    });
  });

  describe('the chairman quest', () => {
    it('the resolution\'s own greenery and its plants never count; the player\'s OWN action-phase greeneries do (0/2 → 1/2 → 2/2, chairman + Agenda)', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.quest?.source).eq(BIODOME_CONTEST_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tile', tile: 'greenery'}, count: 2});
      expect(parliament.questProgressOf(p1), 'the enactment\'s greenery counted nothing').eq(0);
      expect(parliament.questProgressOf(p2)).eq(0);
      // Generation 2: p2 converts plants twice as its OWN action.
      game.phase = Phase.ACTION;
      const agenda = parliament.agendaOf(p2);
      const events = game.events;
      for (let i = 0; i < 2; i++) {
        events.beginAction(p2, {kind: 'standardProject', card: CardName.CONVERT_PLANTS}, {category: 'standard-project'});
        try {
          const space = game.board.getAvailableSpacesForGreenery(p2)[0];
          game.addGreenery(p2, space);
        } finally {
          events.endScope();
        }
        runAllActions(game);
        if (i === 0) {
          expect(parliament.questProgressOf(p2)).eq(1);
          expect(parliament.quest?.completedBy).is.undefined;
        }
      }
      expect(parliament.quest?.completedBy).eq(p2.id);
      answerQuestGate(game, p2);
      expect(parliament.chairman).eq(p2.id);
      expect(parliament.agendaOf(p2)).eq(agenda + 1);
    });

    it('a greenery placed under a resolution source never counts, even in the action phase (the source is on the stack)', () => {
      const [game, p1, , parliament] = stage();
      parliament.quest = {definition: BIODOME_CONTEST.quest, source: BIODOME_CONTEST_ID, generation: 1, progress: new Map()};
      const events = game.events;
      events.beginAction(p1, {kind: 'resolution', id: BIODOME_CONTEST_ID, owner: p1.color}, {category: 'political-phase'});
      try {
        game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
      } finally {
        events.endScope();
      }
      expect(parliament.questProgressOf(p1)).eq(0);
      // The same placement as the player's own action counts.
      events.beginAction(p1, {kind: 'standardProject', card: CardName.CONVERT_PLANTS}, {category: 'standard-project'});
      try {
        expect(QuestTracker.eligible(p1)).is.true;
        game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
      } finally {
        events.endScope();
      }
      expect(parliament.questProgressOf(p1)).eq(1);
    });
  });

  describe('recovery', () => {
    it('a reload inside the placement rebuilds the same question; the plants are never paid twice; the answer places once', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 5);
      setOxygenLevel(game, 4);
      endGeneration(game);
      cast(p1.getWaitingFor(), SelectSpace);
      expect(p1.plants).eq(2);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      const ask = cast(one.getWaitingFor(), SelectSpace);
      expect(ask.placementContext?.source).deep.eq({kind: 'resolution', resolution: BIODOME_CONTEST_ID});
      expect(one.plants, 'the reload pays no plants again').eq(2);
      // And again: still one question, still nothing paid twice.
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const again = cast(one.getWaitingFor(), SelectSpace);
      expect(one.plants).eq(2);
      const tr = one.terraformRating;
      const mc = one.megaCredits;
      const space = quietCell(live, again);
      one.process({type: 'space', spaceId: space.id});
      // A REPEATED answer to the processed question is refused and changes nothing.
      expect(() => one.process({type: 'space', spaceId: space.id})).to.throw();
      runAllActions(live);
      const two = live.getPlayerById(p2.id) as TestPlayer;
      expect(live.getOxygenLevel()).eq(5);
      expect(one.terraformRating).eq(tr + 2);
      expect(one.megaCredits).eq(mc + 4);
      expect(one.plants).eq(2);
      expect(two.plants).eq(6);
      expect(greeneries(live)).eq(1);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      settleParliamentGates(live);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      for (const step of ['plants', 'greenery']) {
        expect(outcomes.filter((o) => o.player === p1.id && o.step === step && o.kind !== 'reaction'), step).has.length(1);
      }
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'plants')).has.length(1);
    });

    it('a save CLONED mid-phase with fresh player ids (the clone feature, a fixture boot) pays nothing twice: per-seat keys travel with the seat', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 5);
      setOxygenLevel(game, 4);
      endGeneration(game);
      cast(p1.getWaitingFor(), SelectSpace);
      expect(p1.plants).eq(2);
      const serialized = structuredClone(game.serialize());
      const oldIds = serialized.players.map((player) => player.id);
      const newIds = oldIds.map((_id, i) => `pclone${i}` as PlayerId);
      Cloner.replacePlayerIds(serialized, oldIds, newIds);
      const live = Game.deserialize(serialized);
      const one = live.getPlayerById(newIds[0]) as TestPlayer;
      const two = live.getPlayerById(newIds[1]) as TestPlayer;
      expect(live.parliament!.phase?.appliedBySeat?.[newIds[0]], 'the winner\'s keys moved to its new id').is.not.undefined;
      expect(one.plants, 'the clone does not pay the winner\'s plants again').eq(2);
      const ask = cast(one.getWaitingFor(), SelectSpace);
      one.process({type: 'space', spaceId: quietCell(live, ask).id});
      runAllActions(live);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.plants).eq(2);
      expect(two.plants).eq(6);
      expect(greeneries(live)).eq(1);
      expect(live.parliament!.lastPhase!.outcomes!.filter((o) => o.player === newIds[0] && o.step === 'plants')).has.length(1);
    });

    it('an OLDER save whose per-seat keys still live in `applied` (with the id inside the key) is honoured', () => {
      const [game, p1] = stage();
      endGeneration(game);
      cast(p1.getWaitingFor(), SelectSpace);
      const serialized = structuredClone(game.serialize());
      const phase = serialized.parliament!.phase!;
      // Rewrite the per-seat record into the legacy shape: `<kind>:<gen>[:<instance>]:<playerId>[:<step>]` in `applied`.
      for (const [player, keys] of Object.entries(phase.appliedBySeat ?? {})) {
        for (const key of keys) {
          const parts = key.split(':');
          phase.applied.push(parts[0] === 'agenda' ? `${key}:${player}` : [...parts.slice(0, 3), player, ...parts.slice(3)].join(':'));
        }
      }
      delete phase.appliedBySeat;
      const live = Game.deserialize(serialized);
      const one = live.getPlayerById(p1.id) as TestPlayer;
      expect(one.plants, 'no second payment from a legacy save').eq(2);
      expect(live.parliament!.agendaOf(p1.id), 'no second Agenda step').eq(1);
      cast(one.getWaitingFor(), SelectSpace);
    });

    it('an enactment interrupted between two players\' plants resumes with the second only (reload AND in-memory re-entry)', () => {
      const [game, p1, p2, parliament] = reduxGame();
      // p2 wins, so p1 (first in generation order) is paid and then p2's payout crashes once.
      seatResolution(parliament, 0, BIODOME);
      parliament.placeVote(p2, parliament.slots[0], 'lobby');
      parliament.agenda.set(p1.id, 3);
      const realAdd = p2.stock.add.bind(p2.stock);
      let failures = 0;
      p2.stock.add = (resource, amount, options) => {
        if (resource === Resource.PLANTS && failures === 0) {
          failures++;
          throw new Error('interrupted');
        }
        realAdd(resource, amount, options);
      };
      expect(() => endGeneration(game)).to.throw('interrupted');
      expect(parliament.phase?.step).eq('effects');
      expect(p1.plants, 'p1 was paid before the interruption').eq(4);
      const live = reload(game);
      const one = live.getPlayerById(p1.id) as TestPlayer;
      const two = live.getPlayerById(p2.id) as TestPlayer;
      expect(one.plants).eq(4);
      expect(two.plants, 'p2 paid on the resume').eq(2);
      const ask = cast(two.getWaitingFor(), SelectSpace);
      two.process({type: 'space', spaceId: quietCell(live, ask).id});
      runAllActions(live);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.plants).eq(4);
      expect(two.plants).eq(2);
      // The in-memory re-entry on the original object behaves the same.
      p2.stock.add = realAdd;
      ParliamentPhase.resume(game, parliament, (final: boolean) => (game as Game).continueAfterParliamentPhase(final));
      expect(p1.plants, 'the re-entry skips the applied key').eq(4);
      expect(p2.plants).eq(2);
      expect(cast(p2.getWaitingFor(), SelectSpace)).is.not.undefined;
    });

    it('a later, legal enactment of the same card pays again (idempotency is per enactment, never forever)', () => {
      const [game, p1, , parliament] = stage();
      endGeneration(game);
      p1.process({type: 'space', spaceId: quietCell(game, cast(p1.getWaitingFor(), SelectSpace)).id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(p1.plants).eq(2);
      // Generation 2: the card leaves ENACTED, returns to the vote and wins again.
      game.phase = Phase.ACTION;
      seatResolution(parliament, 0, BIODOME);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      // step 1 → 2 is a TR step: influence stays 1 → 2 plants more; a second greenery is asked.
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      expect(p1.plants).eq(4);
      p1.process({type: 'space', spaceId: ask.spaces[0].id});
      runAllActions(game);
      expect(greeneries(game)).eq(2);
    });
  });

  describe('MarsBot and the end of the game', () => {
    it('MarsBot (mode none) is never paid, never asked; the human winner places the greenery and the game moves on', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BIODOME);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      // The sitting's barrier is ONE human: the bot holds no gate, the human's answer opens the effects.
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      const ask = cast(human.getWaitingFor(), SelectSpace);
      expect(bot.getWaitingFor()).is.undefined;
      human.process({type: 'space', spaceId: ask.spaces[0].id});
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      expect(bot.plants).eq(0);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(human.plants).eq(2);
    });

    it('the final generation: the effect resolves before the final greeneries, the plants feed them, and greeneries score no VP while city adjacency does', () => {
      const [game, p1, p2, parliament] = stage();
      // Terraformed except nothing: the game ends after this generation's parliament.
      setTemperature(game, MAX_TEMPERATURE);
      maxOutOceans(p2);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      p1.plants = 6; // + 2 from the resolution = one final greenery
      const city = game.board.getAvailableSpacesForCity(p1)[0];
      game.addCity(p1, city);
      expect(game.gameIsOver()).is.true;
      endGeneration(game);
      expect(parliament.phase?.final).is.true;
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      expect(p1.plants).eq(8);
      // The resolution's greenery beside the city: +1 TR (tile), oxygen stays at the maximum.
      const besideCity = ask.spaces.find((s) => game.board.getAdjacentSpaces(s).some((a) => a.id === city.id))!;
      const tr = p1.terraformRating;
      p1.process({type: 'space', spaceId: besideCity.id});
      runAllActions(game);
      expect(p1.terraformRating).eq(tr + 1);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.phase).eq(Phase.PRODUCTION);
      // THE FINAL GREENERY from the resolution's plants: +1 TR for the tile, no oxygen step, 8 plants spent.
      const final = cast(p1.getWaitingFor(), OrOptions);
      const place = cast(final.options[0], SelectSpace);
      const next = place.spaces.find((s) => game.board.getAdjacentSpaces(s).some((a) => a.id === city.id))!;
      p1.process({type: 'or', index: 0, response: {type: 'space', spaceId: next.id}});
      expect(p1.plants).eq(0);
      expect(p1.terraformRating).eq(tr + 2);
      expect(game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      const vp = p1.getVictoryPoints();
      expect(vp.greenery, 'Redux: no VP per greenery').eq(0);
      expect(vp.city, 'the city still scores both adjacent greeneries').eq(2);
    });
  });
});
