import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {MOHOLE_CONTEST, MOHOLE_CONTEST_CODE, MOHOLE_CONTEST_HEAT, MOHOLE_CONTEST_ID, MOHOLE_CONTEST_TEMPERATURE} from '../../src/server/parliament/resolutions/greens/MoholeContest';
import {GAS_EXPORT, GAS_EXPORT_ID} from '../../src/server/parliament/resolutions/reds/GasExport';
import {WINNER_STEP_AT_MAXIMUM_REASON, winnerParameterStep} from '../../src/server/parliament/resolutions/WinnerParameterStep';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {parameterRoom} from '../../src/common/parliament/parameterMove';
import {
  isWinnerParameterReward, winnerParameterRoom, winnerParameterStepKey, winnerRewardParameter, winnerRewardTr,
} from '../../src/common/parliament/winnerReward';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {cast} from '../../src/common/utils/utils';
import {maxOutOceans, runAllActions, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';

/**
 * MOHOLE CONTEST (Turmoil Redux, RX23) — 3 heat per influence for every
 * participant, and the WINNER raises the temperature 2 steps: the first
 * winner part that is a DIRECT STEP of a global parameter (no tile), paid by
 * the family's shared executor from the declaration.
 *
 * What these specs pin: the per-seat heat; the winner's step REWARDED — +2 TR
 * to the winner and nobody else, the −24 °C heat production, the Greens' M€
 * for the TR, the 0 °C ocean as the winner's own standard placement the phase
 * waits out; the ceiling NAMED (one step from it, one step; at it, a skip and
 * the heat still paid); the winner's part independent of its influence; a
 * neutral winner raising nothing; the record carrying the steps made, the
 * values and the TR; a reload paying nothing twice; MarsBot never in it; and
 * PARITY with Gas Export — a world move still credits nobody, a winner's step
 * never carries the world's flag.
 */
const MOHOLE = resolutionInstanceId(MOHOLE_CONTEST_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Mohole Contest in slot 0 with p1's delegate on it, so p1 wins it. Temperature −20 °C (room for two steps, no threshold on the way). */
function stage(temperature = -20): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, MOHOLE);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  setTemperature(game, temperature);
  p1.heat = 0;
  p2.heat = 0;
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function settle(game: IGame): void {
  runAllActions(game);
  settleParliamentGates(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function stepOutcome(parliament: Parliament, player: TestPlayer) {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).find((o) => o.player === player.id && o.step === 'temperature' && o.kind !== 'reaction');
}

function heatOutcome(parliament: Parliament, player: TestPlayer) {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).find((o) => o.player === player.id && o.step === 'heat');
}

describe('MoholeContest', () => {
  describe('the catalog entry', () => {
    it('is RX23 of the Greens — one copy, no expansion needed, the one-microbe-tag quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(MOHOLE_CONTEST_ID)).eq(MOHOLE_CONTEST);
      expect(MOHOLE_CONTEST_CODE).eq('RX23');
      expect(MOHOLE_CONTEST_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX23')).eq(MOHOLE_CONTEST);
      expect(MOHOLE_CONTEST.party).eq(PartyName.GREENS);
      expect(MOHOLE_CONTEST.copies).eq(1);
      expect(MOHOLE_CONTEST.compatibility).is.undefined;
      expect(MOHOLE_CONTEST.quest).deep.eq({goal: {kind: 'tag', tag: Tag.MICROBE}, count: 1});
      expect(MOHOLE_CONTEST.scaled).deep.eq([MOHOLE_CONTEST_HEAT]);
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((instance) => instance === MOHOLE)).has.length(1);
    });

    it('declares the winner\'s part as a PARAMETER STEP — the third kind — and lists the shared step under the derived key', () => {
      const reward = MOHOLE_CONTEST.winnerReward;
      expect(reward).deep.eq({kind: 'parameter', parameter: 'temperature', steps: 2});
      expect(reward !== undefined && isWinnerParameterReward(reward)).is.true;
      expect(winnerRewardParameter(MOHOLE_CONTEST_TEMPERATURE)).eq('temperature');
      expect(winnerParameterStepKey(MOHOLE_CONTEST_TEMPERATURE)).eq('temperature');
      expect((MOHOLE_CONTEST.winnerSteps ?? []).map((s) => s.key)).deep.eq(['temperature']);
      expect(MOHOLE_CONTEST.text.winner, 'the inspector reads the winner part as its own block').is.a('string');
      expect(MOHOLE_CONTEST.worldMoves, 'the step is the WINNER\'s, never the world\'s').is.undefined;
      expect(MOHOLE_CONTEST.worldSteps).is.undefined;
    });

    it('the shared formula: 3 heat per point of influence, nothing below zero, no cap', () => {
      expect(scaledAmount(MOHOLE_CONTEST_HEAT, 0)).eq(0);
      expect(scaledAmount(MOHOLE_CONTEST_HEAT, 1)).eq(3);
      expect(scaledAmount(MOHOLE_CONTEST_HEAT, 3)).eq(9);
      expect(scaledAmount(MOHOLE_CONTEST_HEAT, -2)).eq(0);
      expect(MOHOLE_CONTEST_HEAT.cap).is.undefined;
    });

    it('the shared ROOM reads the winner\'s step as the engine pays it: two steps, the ceiling\'s cut, the thresholds and the ocean', () => {
      const far = winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: -20, oceans: 3});
      expect(far).deep.include({parameter: 'temperature', steps: 2, applied: 2, rises: true, current: -20, resulting: -16, tileAvailable: true, heatProductionBonus: 0, oceanBonus: false});
      expect(winnerRewardTr(MOHOLE_CONTEST_TEMPERATURE, far)).deep.eq({tile: 0, parameter: 2, temperature: 0});
      const cut = winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: 6, oceans: 3});
      expect(cut).deep.include({applied: 1, rises: true, resulting: MAX_TEMPERATURE});
      expect(winnerRewardTr(MOHOLE_CONTEST_TEMPERATURE, cut).parameter).eq(1);
      const max = winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: MAX_TEMPERATURE, oceans: 3});
      expect(max).deep.include({applied: 0, rises: false, resulting: MAX_TEMPERATURE});
      expect(winnerRewardTr(MOHOLE_CONTEST_TEMPERATURE, max)).deep.eq({tile: 0, parameter: 0, temperature: 0});
      const heat = winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: -26, oceans: 3});
      expect(heat).deep.include({applied: 2, resulting: -22, heatProductionBonus: 1, oceanBonus: false});
      const both = winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: -24, oceans: 3});
      expect(both).deep.include({resulting: -20, heatProductionBonus: 1});
      const ocean = winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: -4, oceans: 3});
      expect(ocean).deep.include({resulting: 0, oceanBonus: true});
      expect(winnerParameterRoom(MOHOLE_CONTEST_TEMPERATURE, {oxygenLevel: 5, temperature: -4, oceans: 9}).oceanBonus, 'no ocean left: none follows').is.false;
      // The SAME arithmetic a world move reads — one function.
      expect(parameterRoom({parameter: 'temperature', steps: 2}, {oxygenLevel: 5, temperature: -26, oceans: 3})).deep.include({applied: 2, heatProductionBonus: 1});
    });

    it('the stand opens the WINNER-TILE family from the declaration alone (a winner part, no card to pick)', () => {
      expect(familyOf(MOHOLE_CONTEST)).eq('winner-tile');
    });
  });

  describe('the heat payout', () => {
    it('pays every participant 3 × THEIR influence into the supply — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      settle(game);
      expect(parliament.agendaOf(p1)).eq(1);
      expect(heatOutcome(parliament, p1), 'the winner: 3 × 1').deep.include({kind: 'stock', stock: Resource.HEAT, amount: 3, influence: 1, before: 0, after: 3});
      expect(heatOutcome(parliament, p2), 'a non-voter by its own track: 3 × 3').deep.include({kind: 'stock', amount: 9, influence: 3});
      expect(p1.heat).eq(3);
      expect(p2.heat).eq(9);
    });

    it('influence 0 pays nothing and NAMES it — the winner\'s step is untouched by anybody\'s influence', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      settle(game);
      expect(heatOutcome(parliament, p2)).deep.include({kind: 'skipped', amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((e) => e.message === '${0} has no influence — no heat from ${1}')).is.true;
      // The winner's step neither reads nor records an influence: it happened, whole.
      const step = stepOutcome(parliament, p1);
      expect(step).deep.include({kind: 'globalParameter', part: 'winner', amount: 2});
      expect(step?.influence).is.undefined;
    });
  });

  describe('the winner\'s step — REWARDED, as a player\'s own raise', () => {
    it('raises the temperature two steps and pays the WINNER +2 TR (the record carries the steps, the values and the TR); nobody else moves', () => {
      const [game, p1, p2, parliament] = stage();
      const tr = [p1.terraformRating, p2.terraformRating];
      endGeneration(game);
      settle(game);
      expect(game.getTemperature()).eq(-16);
      // The Agenda step 0 → 1 pays no TR; the two temperature steps pay 2.
      expect(p1.terraformRating, '+1 TR per step, to the winner').eq(tr[0] + 2);
      expect(p2.terraformRating, 'the other seat gains nothing for the winner\'s step').eq(tr[1]);
      expect(stepOutcome(parliament, p1)).deep.eq({
        player: p1.id, step: 'temperature', part: 'winner', kind: 'globalParameter', amount: 2, parameter: {id: 'temperature', before: -20, after: -16}, tr: 2,
      });
      expect(stepOutcome(parliament, p1)?.unrewarded, 'never the world\'s flag').is.undefined;
      expect(stepOutcome(parliament, p2), 'no step of the other seat').is.undefined;
    });

    it('the Greens rule the moment the card is enacted: their ordinary hook pays 2 M€ per TR step, and the driver records it as the party\'s REACTION under the step', () => {
      const [game, p1, , parliament] = stage();
      // The production phase pays the seat's income (its rating) BEFORE the sitting; the sitting adds the Greens' answer on top.
      const income = p1.terraformRating + p1.production.megacredits;
      endGeneration(game);
      settle(game);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      expect(p1.megaCredits, '2 M€ × 2 TR, on top of the income').eq(income + 4);
      const reaction = parliament.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === 'temperature' && o.kind === 'reaction');
      expect(reaction).deep.include({party: PartyName.GREENS, trigger: 'tr-increase', stock: Resource.MEGACREDITS, amount: 4});
    });

    it('the raise is a first-class event CREDITED to the winner and sourced by the law — the opposite of a world move', () => {
      const [game, p1] = stage();
      endGeneration(game);
      settle(game);
      const raises = game.events.serialize().events.filter((e) => e.type === 'global-parameter-changed' &&
        e.impact.globalParameter?.parameter === GlobalParameter.TEMPERATURE);
      expect(raises).has.length(1);
      expect(raises[0].impact.globalParameter?.steps).eq(2);
      expect(raises[0].player, 'the WINNER made the step').eq(p1.color);
      expect(raises[0].source).deep.eq({kind: 'resolution', id: MOHOLE_CONTEST_ID, owner: p1.color});
    });

    it('ONE step from the ceiling: one step happens, +1 TR, and the record carries the step actually made', () => {
      const [game, p1, , parliament] = stage(6);
      const tr = p1.terraformRating;
      endGeneration(game);
      settle(game);
      expect(game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(p1.terraformRating).eq(tr + 1);
      expect(stepOutcome(parliament, p1)).deep.include({kind: 'globalParameter', amount: 1, parameter: {id: 'temperature', before: 6, after: 8}, tr: 1});
      const line = game.gameLog.find((e) => e.message === '${0} raised ${1} ${2} step(s) from ${3} (${4} → ${5}) and gains ${6} TR');
      expect(line?.data[2].value, 'the journal says one step').eq('1');
      expect(line?.data[6].value).eq('1');
    });

    it('AT the ceiling: the winner\'s step is a NAMED skip — no TR, no engine silence — and the heat still reaches everyone', () => {
      const [game, p1, p2, parliament] = stage(MAX_TEMPERATURE);
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      const tr = p1.terraformRating;
      endGeneration(game);
      settle(game);
      expect(game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(p1.terraformRating, 'nothing for a step that did not happen').eq(tr);
      expect(stepOutcome(parliament, p1)).deep.include({kind: 'skipped', part: 'winner', amount: 0, reason: WINNER_STEP_AT_MAXIMUM_REASON.temperature});
      expect(stepOutcome(parliament, p1)?.parameter).deep.eq({id: 'temperature', before: MAX_TEMPERATURE, after: MAX_TEMPERATURE});
      expect(WINNER_STEP_AT_MAXIMUM_REASON.temperature).eq('Temperature is at its maximum — it is not raised');
      expect(game.gameLog.some((e) => e.message === '${0} is at its maximum — the winner\'s step from ${1} is skipped')).is.true;
      expect(p1.heat, 'the heat is the other part — paid').eq(3);
      expect(p2.heat).eq(6);
    });

    it('crossing −24 °C pays the winner the track\'s heat production — and the Greens answer THAT too', () => {
      const [game, p1, p2, parliament] = stage(-26);
      endGeneration(game);
      settle(game);
      expect(game.getTemperature()).eq(-22);
      expect(p1.production.heat, 'the −24 °C step').eq(1);
      expect(p2.production.heat).eq(0);
      expect(p1.production.megacredits, 'the Greens: +1 M€ production for the heat production step').eq(1);
      const reactions = (parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === p1.id && o.step === 'temperature' && o.kind === 'reaction');
      expect(reactions.map((r) => `${r.trigger}:${r.production ?? r.stock}:${r.amount}`).sort()).deep.eq(['production-gain:megacredits:1', 'tr-increase:megacredits:4'].sort());
    });

    it('reaching 0 °C: the ocean is the winner\'s OWN standard placement, the phase waits for it, the other seat reads WHO is placing, and the winner gets the tile\'s TR too', () => {
      const [game, p1, p2, parliament] = stage(-4);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      const tr = p1.terraformRating;
      endGeneration(game);
      expect(game.getTemperature()).eq(0);
      // The engine's own follow-up asks the WINNER — its source is the bonus step's, not the resolution's.
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      expect(ocean.placementContext?.source).deep.eq({kind: 'system', name: 'Temperature bonus step'});
      expect(ocean.spaces.every((s) => game.board.getAvailableSpacesForOcean(p1).includes(s))).is.true;
      expect(p2.heat, 'the phase waits for the ocean before it visits the next seat').eq(0);
      expect(stepOutcome(parliament, p1), 'the step itself is recorded already').deep.include({kind: 'globalParameter', amount: 2, tr: 2});
      // THE MODEL names the tail as the step's own ask — every seat reads the honest wait, the winner a step of the sitting.
      const pending = getParliamentModel(game, p2)?.phase?.pending;
      expect(pending).deep.eq({player: p1.color, key: 'temperature', input: 'space'});
      const space = ocean.spaces.find((s) => s.bonus.length === 0) ?? ocean.spaces[0];
      p1.process({type: 'space', spaceId: space.id});
      settle(game);
      expect(space.tile?.tileType).eq(TileType.OCEAN);
      expect(p1.terraformRating, '2 steps + the ocean').eq(tr + 3);
      expect(p2.heat, 'the next seat is paid once the ocean is down').eq(3);
      expect(getParliamentModel(game, p2)?.phase?.pending, 'nothing pending once the tail is answered').is.undefined;
    });

    it('reaching 0 °C with no ocean left: the step still happens (2 TR), no placement is asked, the phase goes on', () => {
      const [game, p1, p2, parliament] = stage(-4);
      maxOutOceans(p1);
      const tr = p1.terraformRating;
      endGeneration(game);
      settle(game);
      expect(game.getTemperature()).eq(0);
      expect(p1.terraformRating).eq(tr + 2);
      expect(stepOutcome(parliament, p1)).deep.include({kind: 'globalParameter', amount: 2, tr: 2});
      expect(parliament.phase, 'the sitting is over').is.undefined;
      expect(p2.getWaitingFor()).is.not.instanceOf(SelectSpace);
    });

    it('a NEUTRAL winner raises nothing; the heat still reaches every participant', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, MOHOLE);
      parliament.addNeutralVote(parliament.slots[0]);
      setTemperature(game, -20);
      parliament.agenda.set(p1.id, agendaForInfluence(1));
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.heat = 0;
      p2.heat = 0;
      endGeneration(game);
      settle(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(game.getTemperature(), 'nobody made the step').eq(-20);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.step === 'temperature')).is.false;
      expect(p1.heat).eq(3);
      expect(p2.heat).eq(6);
    });

    it('the journal attributes the raise to the WINNER and the resolution, with the steps and the TR', () => {
      const [game, p1] = stage();
      endGeneration(game);
      settle(game);
      const line = game.gameLog.find((e) => e.message === '${0} raised ${1} ${2} step(s) from ${3} (${4} → ${5}) and gains ${6} TR');
      expect(line, 'the raise is in the journal').is.not.undefined;
      expect(line?.data[0].type).eq(LogMessageDataType.PLAYER);
      expect(line?.data[0].value).eq(p1.color);
      expect(line?.data[2].value).eq('2');
      expect(line?.data[3].value).eq(MOHOLE_CONTEST_ID);
      expect(line?.data[4].value).eq('-20');
      expect(line?.data[5].value).eq('-16');
      expect(line?.data[6].value).eq('2');
    });
  });

  describe('PARITY with the world move (Gas Export, RX12)', () => {
    it('a world move still declares that nobody is credited; the winner\'s step declares no such switch and is paid through the rewarded gate', () => {
      expect((GAS_EXPORT.worldMoves ?? []).every((move) => move.terraformRating === false), 'Gas Export: no TR for anybody').is.true;
      expect(REDUX_RESOLUTION_CATALOG.get(GAS_EXPORT_ID)?.winnerReward).is.undefined;
      expect(MOHOLE_CONTEST_TEMPERATURE).not.has.property('terraformRating');
    });

    it('Gas Export\'s Venus raise still moves nobody\'s rating on the same engine', () => {
      const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
      const parliament = game.parliament!;
      game.phase = Phase.ACTION;
      seatResolution(parliament, 0, resolutionInstanceId(GAS_EXPORT_ID, 0));
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      setVenusScaleLevel(game, 10);
      const tr = [p1.terraformRating, p2.terraformRating];
      endGeneration(game);
      settle(game);
      expect(game.getVenusScaleLevel()).eq(14);
      expect(p1.terraformRating - tr[0], 'the winner gains at most its Agenda step').to.be.at.most(1);
      expect(p2.terraformRating).eq(tr[1]);
      const world = parliament.lastPhase?.outcomes?.find((o) => o.step === 'venus');
      expect(world).deep.include({part: 'world', kind: 'globalParameter', unrewarded: true});
      expect(world?.tr, 'a world record carries no rating').is.undefined;
    });

    it('the shared executor refuses nothing it is not given: a step for another parameter is one declaration too', () => {
      const step = winnerParameterStep('RDX_TEST', {kind: 'parameter', parameter: 'venus', steps: 1});
      expect(step.key).eq('venus');
    });
  });

  describe('recovery and the other players', () => {
    it('a reload after the sitting keeps the temperature, the record and the rating — nothing is paid twice', () => {
      const [game, p1] = stage();
      endGeneration(game);
      settle(game);
      const tr = p1.terraformRating;
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(live.getTemperature()).eq(-16);
      expect(one.terraformRating).eq(tr);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'temperature' && o.kind !== 'reaction')).has.length(1);
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'heat')).has.length(1);
    });

    it('an in-memory reload BETWEEN the winner\'s steps and the next seat pays the next seat once, never the winner again', () => {
      const [game, p1, p2, parliament] = stage(-4);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      const trBefore = p1.terraformRating;
      p1.process({type: 'space', spaceId: (ocean.spaces.find((s) => s.bonus.length === 0) ?? ocean.spaces[0]).id});
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      runAllActions(live);
      settleParliamentGates(live);
      expect(live.getTemperature(), 'raised once').eq(0);
      expect(one.terraformRating, 'the ocean TR once, nothing twice').eq(trBefore + 1);
      expect(two.heat).eq(3);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'temperature' && o.kind !== 'reaction')).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'heat')).has.length(1);
    });

    it('MarsBot (mode none) is never paid and never makes the step; the human winner does', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, MOHOLE);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      setTemperature(game, -20);
      human.heat = 0;
      bot.heat = 0;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor(), 'the bot is never asked a political question').is.undefined;
      settle(game);
      expect(parliament.phase, 'nothing of this card asks anything here — the sitting closes on its own').is.undefined;
      // The bot's own turn may have moved the temperature before the sitting: the record is read relatively.
      const step = parliament.lastPhase?.outcomes?.find((o) => o.player === human.id && o.step === 'temperature' && o.kind !== 'reaction');
      expect(step).deep.include({kind: 'globalParameter', amount: 2, tr: 2});
      expect((step?.parameter?.after ?? 0) - (step?.parameter?.before ?? 0)).eq(4);
      expect(game.getTemperature()).eq(step?.parameter?.after);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id), 'the bot is never a recipient').is.false;
      expect(bot.heat).eq(0);
      expect(human.heat).eq(3);
    });

    it('the model carries the winner\'s record to every client with its colour, the steps and the TR', () => {
      const [game, p1, p2] = stage();
      endGeneration(game);
      settle(game);
      for (const viewer of [p1, p2]) {
        const outcomes = getParliamentModel(game, viewer)?.lastPhase?.outcomes ?? [];
        const step = outcomes.find((o) => o.step === 'temperature' && o.kind === 'globalParameter');
        expect(step, `viewer ${viewer.color}`).deep.include({player: p1.color, part: 'winner', amount: 2, tr: 2});
        expect(step?.parameter).deep.eq({id: 'temperature', before: -20, after: -16});
        expect(step?.unrewarded).is.undefined;
      }
    });

    it('once enacted, the GREENS rule', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      settle(game);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      expect(parliament.hasPartyEffect(p1, PartyName.GREENS)).is.true;
      expect(parliament.hasPartyEffect(p2, PartyName.GREENS)).is.true;
    });
  });
});
