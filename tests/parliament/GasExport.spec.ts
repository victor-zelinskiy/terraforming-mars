import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  GAS_EXPORT, GAS_EXPORT_CODE, GAS_EXPORT_ID, GAS_EXPORT_MEGACREDITS, GAS_EXPORT_OXYGEN, GAS_EXPORT_VENUS,
} from '../../src/server/parliament/resolutions/reds/GasExport';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {parameterRoom} from '../../src/common/parliament/parameterMove';
import {MAX_OXYGEN_LEVEL, MAX_VENUS_SCALE} from '../../src/common/constants';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * GAS EXPORT (Turmoil Redux, RX12) — the first resolution that changes THE
 * WORLD instead of paying the table: 2 M€ per influence for every participant,
 * then oxygen −1 step (unless it is at its maximum) and Venus +2 steps, with
 * NOBODY credited for either.
 *
 * What these specs pin: the per-seat payout by each seat's own influence; the
 * world part running ONCE per enactment (a neutral winner included) and
 * belonging to no seat; both limits NAMED rather than silently skipped; the
 * ceiling cutting the Venus raise; no terraform rating anywhere and no Venus
 * track bonus (the World-Government parity of decision D1); the lowering
 * recorded as a SIGNED event; a reload inside the enactment moving nothing
 * twice; the journal attributing the move to the LAW, not to the engine's
 * handle; and the 8 % temperature bonus re-arming on the way back up exactly
 * as the Reds' own agenda action leaves it.
 */
const GAS = resolutionInstanceId(GAS_EXPORT_ID, 0);

function reduxGame(venus = true): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: venus});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Gas Export in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, GAS);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament];
}

/** Seat Gas Export with a NEUTRAL delegate on it — the world part must still happen. */
function stageNeutral(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, GAS);
  parliament.addNeutralVote(parliament.slots[0]);
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
  settleParliamentGates(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function worldOutcome(parliament: Parliament, step: 'oxygen' | 'venus') {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === undefined && o.step === step);
}

function seatOutcome(parliament: Parliament, player: TestPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'megacredits');
}

describe('GasExport', () => {
  describe('the catalog entry', () => {
    it('is RX12 of the Reds — Venus Next only, one copy, the two-Venus-tag quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(GAS_EXPORT_ID)).eq(GAS_EXPORT);
      expect(GAS_EXPORT_CODE).eq('RX12');
      expect(GAS_EXPORT_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX12')).eq(GAS_EXPORT);
      expect(GAS_EXPORT.party).eq(PartyName.REDS);
      expect(GAS_EXPORT.copies).eq(1);
      expect(GAS_EXPORT.compatibility).deep.eq(['venus']);
      expect(GAS_EXPORT.quest).deep.eq({goal: {kind: 'tag', tag: Tag.VENUS}, count: 2});
      expect(GAS_EXPORT.winnerSteps, 'no winner-only part — «when enacted», not «the winner»').is.undefined;
      expect(GAS_EXPORT.winnerReward).is.undefined;
    });

    it('declares its WORLD part on all three layers: the data, the steps and the sentence', () => {
      expect(GAS_EXPORT.worldMoves).deep.eq([GAS_EXPORT_OXYGEN, GAS_EXPORT_VENUS]);
      expect(GAS_EXPORT_OXYGEN).deep.eq({parameter: 'oxygen', steps: -1, terraformRating: false});
      expect(GAS_EXPORT_VENUS).deep.eq({parameter: 'venus', steps: 2, terraformRating: false});
      expect((GAS_EXPORT.worldSteps ?? []).map((s) => s.key)).deep.eq(['oxygen', 'venus']);
      expect(GAS_EXPORT.text.world, 'the inspector reads the world part as its own block').is.a('string');
    });

    it('the shared formula: 2 M€ per point of influence, nothing below zero', () => {
      expect(scaledAmount(GAS_EXPORT_MEGACREDITS, 0)).eq(0);
      expect(scaledAmount(GAS_EXPORT_MEGACREDITS, 1)).eq(2);
      expect(scaledAmount(GAS_EXPORT_MEGACREDITS, 3)).eq(6);
      expect(scaledAmount(GAS_EXPORT_MEGACREDITS, -2)).eq(0);
      expect(GAS_EXPORT_MEGACREDITS.cap, 'no cap').is.undefined;
    });

    it('is in the deck of a Venus game and NOWHERE in a game without Venus Next', () => {
      const pool = (p: Parliament) => [...p.deck, ...p.discard, ...p.slots.map((s) => s.instance), ...(p.enacted === undefined ? [] : [p.enacted])];
      expect(pool(reduxGame(true)[3])).includes(GAS);
      expect(pool(reduxGame(false)[3])).not.includes(GAS);
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances((d) => (d.compatibility ?? []).every((e) => e !== 'venus'))).not.includes(GAS);
    });

    it('the stand opens the WORLD-MOVE family from the declaration alone', () => {
      expect(familyOf(GAS_EXPORT)).eq('world-move');
    });
  });

  describe('the M€ payout', () => {
    it('pays every participant 2 × THEIR influence — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner) starts at the track's foot: the phase's Agenda step takes it to step 1 = influence 1.
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      expect(parliament.agendaOf(p1)).eq(1);
      // The record is the payout (the generation's own income lands in the same chain, so a bare balance is not it).
      const one = seatOutcome(parliament, p1);
      const two = seatOutcome(parliament, p2);
      expect(one, 'the winner: 2 × 1').deep.include({kind: 'stock', stock: Resource.MEGACREDITS, amount: 2, influence: 1});
      expect(two, 'a non-voter by its own track: 2 × 3').deep.include({kind: 'stock', amount: 6, influence: 3});
      expect((one?.after ?? 0) - (one?.before ?? 0)).eq(2);
      expect((two?.after ?? 0) - (two?.before ?? 0)).eq(6);
    });

    it('influence 0 pays nothing and NAMES it', () => {
      const [game, p1, , parliament] = stageNeutral();
      endGeneration(game);
      expect(seatOutcome(parliament, p1)).deep.include({kind: 'skipped', amount: 0, influence: 0, reason: 'No influence'});
      void p1;
      expect(game.gameLog.some((e) => e.message === '${0} has no influence — no M€ from ${1}')).is.true;
    });
  });

  describe('the world\'s part', () => {
    it('lowers oxygen one step and raises Venus two — ONCE, for the whole table', () => {
      const [game, , , parliament] = stage();
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 2);
      game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 2);
      game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 1);
      const oxygenBefore = game.getOxygenLevel();
      const venusBefore = game.getVenusScaleLevel();
      expect(oxygenBefore).eq(4);
      expect(venusBefore).eq(10);
      endGeneration(game);
      expect(game.getOxygenLevel(), 'one step down, once — never once per seat').eq(oxygenBefore - 1);
      expect(game.getVenusScaleLevel(), 'two steps up, 2 % apiece').eq(venusBefore + 4);
      expect(worldOutcome(parliament, 'oxygen')).deep.include({
        kind: 'globalParameter', part: 'world', amount: -1, unrewarded: true,
      });
      expect(worldOutcome(parliament, 'oxygen')?.parameter).deep.eq({id: 'oxygen', before: 4, after: 3});
      expect(worldOutcome(parliament, 'venus')).deep.include({kind: 'globalParameter', part: 'world', amount: 2, unrewarded: true});
      expect(worldOutcome(parliament, 'venus')?.parameter).deep.eq({id: 'venus', before: 10, after: 14});
      // A WORLD record belongs to NO seat — that is what makes it everybody's.
      expect(worldOutcome(parliament, 'oxygen')?.player).is.undefined;
      expect(worldOutcome(parliament, 'venus')?.player).is.undefined;
    });

    it('a NEUTRAL winner changes nothing about it: «when enacted», not «the winner»', () => {
      const [game, , , parliament] = stageNeutral();
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      endGeneration(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(game.getOxygenLevel()).eq(1);
      expect(game.getVenusScaleLevel()).eq(4);
      expect(worldOutcome(parliament, 'oxygen')?.amount).eq(-1);
      expect(worldOutcome(parliament, 'venus')?.amount).eq(2);
    });

    it('oxygen AT ITS MAXIMUM is not reduced — and the skip is NAMED, never a silent early exit', () => {
      const [game, , , parliament] = stage();
      for (let i = 0; i < MAX_OXYGEN_LEVEL / 2; i++) {
        game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      }
      expect(game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      endGeneration(game);
      expect(game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      expect(worldOutcome(parliament, 'oxygen')).deep.include({
        kind: 'skipped', amount: 0, reason: 'Oxygen is at its maximum — it is not reduced',
      });
      expect(game.gameLog.some((e) => e.message === 'Oxygen is at its maximum — ${0} does not reduce it')).is.true;
      // …and Venus still moves: the two moves are independent.
      expect(game.getVenusScaleLevel()).eq(4);
    });

    it('oxygen AT ITS MINIMUM cannot go lower — named too', () => {
      const [game, , , parliament] = stage();
      expect(game.getOxygenLevel()).eq(0);
      endGeneration(game);
      expect(game.getOxygenLevel()).eq(0);
      expect(worldOutcome(parliament, 'oxygen')).deep.include({kind: 'skipped', amount: 0, reason: 'Oxygen is already at its minimum'});
      expect(game.gameLog.some((e) => e.message === 'Oxygen is already at its minimum — ${0} cannot reduce it')).is.true;
    });

    it('Venus at 28 %: the ceiling cuts the raise to ONE step, and the record carries the step actually made', () => {
      const [game, , , parliament] = stage();
      for (let i = 0; i < 7; i++) {
        game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 2);
      }
      expect(game.getVenusScaleLevel()).eq(28);
      endGeneration(game);
      expect(game.getVenusScaleLevel()).eq(MAX_VENUS_SCALE);
      expect(worldOutcome(parliament, 'venus')).deep.include({kind: 'globalParameter', amount: 1});
      expect(worldOutcome(parliament, 'venus')?.parameter).deep.eq({id: 'venus', before: 28, after: 30});
    });

    it('Venus AT ITS MAXIMUM is not terraformed — named', () => {
      const [game, , , parliament] = stage();
      for (let i = 0; i < 5; i++) {
        game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 3);
      }
      expect(game.getVenusScaleLevel()).eq(MAX_VENUS_SCALE);
      endGeneration(game);
      expect(worldOutcome(parliament, 'venus')).deep.include({
        kind: 'skipped', amount: 0, reason: 'Venus is at its maximum — it is not terraformed',
      });
    });

    it('the shared ROOM model answers exactly what the steps do (the reading and the payout are one arithmetic)', () => {
      const table = {oxygenLevel: 5, temperature: -20, oceans: 3, venusScaleLevel: 10};
      expect(parameterRoom(GAS_EXPORT_OXYGEN, table)).deep.include({current: 5, applied: -1, resulting: 4, moves: true, atLimit: false});
      // At the CEILING a lowering still has room — «if oxygen is not at maximum» is the CARD's own clause,
      // not an arithmetic limit, and the step states it itself.
      expect(parameterRoom(GAS_EXPORT_OXYGEN, {...table, oxygenLevel: MAX_OXYGEN_LEVEL})).deep.include({applied: -1, atLimit: false});
      expect(parameterRoom(GAS_EXPORT_OXYGEN, {...table, oxygenLevel: 0})).deep.include({applied: 0, atLimit: true, resulting: 0});
      expect(parameterRoom(GAS_EXPORT_VENUS, table)).deep.include({current: 10, applied: 2, resulting: 14});
      expect(parameterRoom(GAS_EXPORT_VENUS, {...table, venusScaleLevel: 28})).deep.include({applied: 1, resulting: 30});
      expect(parameterRoom(GAS_EXPORT_VENUS, {...table, venusScaleLevel: 30})).deep.include({applied: 0, atLimit: true});
    });
  });

  describe('«no one gets the TR for this» — the World Government\'s parity (decision D1)', () => {
    it('nobody\'s rating moves, and the Venus track pays no bonus', () => {
      const [game, p1, p2, parliament] = stage();
      // Venus at 6 %: the two steps cross the 8 % CARD bonus. Nothing may be paid for it.
      game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 3);
      expect(game.getVenusScaleLevel()).eq(6);
      const before = [p1.terraformRating, p2.terraformRating];
      const hands = [p1.cardsInHand.length, p2.cardsInHand.length];
      endGeneration(game);
      expect(game.getVenusScaleLevel()).eq(10);
      // The winner's rating moved ONLY by its Agenda step, if that step pays one; nothing else did.
      expect(p2.terraformRating, 'a seat that did nothing gains no rating for the law\'s terraforming').eq(before[1]);
      expect(p1.terraformRating - before[0], 'the winner gains at most its Agenda step — never the law\'s two Venus steps').to.be.at.most(1);
      expect(p1.cardsInHand.length, 'the Venus 8 % card bonus is a TRACK bonus — not paid').eq(hands[0]);
      expect(p2.cardsInHand.length).eq(hands[1]);
      expect(worldOutcome(parliament, 'venus')).deep.include({unrewarded: true});
    });

    it('the crossed threshold is claimed NEUTRALLY, exactly as the World Government claims one', () => {
      const [game] = stage();
      game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 3);
      endGeneration(game);
      const claims = new Map(game.serialize().scaleBonusClaims ?? []);
      expect(claims.get('venus-8'), 'nobody terraformed this threshold').eq('neutral');
    });

    it('the 16 % rating bonus is a track bonus too — not paid', () => {
      const [game, p1, p2] = stage();
      // 14 % → the law's raise crosses the 16 % rating bonus.
      for (let i = 0; i < 7; i++) {
        game.increaseVenusScaleLevel(game.playersInGenerationOrder[0], 1);
      }
      expect(game.getVenusScaleLevel()).eq(14);
      const before = [p1.terraformRating, p2.terraformRating];
      endGeneration(game);
      expect(game.getVenusScaleLevel()).eq(18);
      expect(p2.terraformRating).eq(before[1]);
      expect(p1.terraformRating - before[0]).to.be.at.most(1);
    });
  });

  describe('the event stream and the journal', () => {
    it('the LOWERING is a first-class event with its SIGN, attributed to nobody', () => {
      const [game] = stage();
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      endGeneration(game);
      const events = game.events.serialize().events;
      const lowering = events.filter((e) => e.type === 'global-parameter-changed' &&
        e.impact.globalParameter?.parameter === GlobalParameter.OXYGEN && (e.impact.globalParameter?.steps ?? 0) < 0);
      expect(lowering, 'exactly one, and it is negative').has.length(1);
      expect(lowering[0].impact.globalParameter?.steps).eq(-1);
      expect(lowering[0].player, 'the LAW lowered it — never the player the engine was handed').is.undefined;
      expect(lowering[0].source).deep.eq({kind: 'resolution', id: GAS_EXPORT_ID});
      // …and the Venus raise is recorded the same way: no author, since nobody was credited.
      const raise = events.find((e) => e.type === 'global-parameter-changed' && e.impact.globalParameter?.parameter === GlobalParameter.VENUS);
      expect(raise?.impact.globalParameter?.steps).eq(2);
      expect(raise?.player).is.undefined;
    });

    it('the journal attributes both moves to the resolution, never to a player', () => {
      const [game] = stage();
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      endGeneration(game);
      const oxygen = game.gameLog.find((e) => e.message === '${0} reduced the oxygen level 1 step (${1}% → ${2}%)');
      expect(oxygen, 'the lowering is in the journal').is.not.undefined;
      expect(oxygen?.data[0].value).eq(GAS_EXPORT_ID);
      const venus = game.gameLog.find((e) => e.message === '${0} terraformed Venus ${1} step(s) (${2}% → ${3}%) — no one gets the terraform rating');
      expect(venus?.data[0].value).eq(GAS_EXPORT_ID);
    });

    it('the Reds\' own agenda action still lowers, and its event is recorded too', () => {
      const [game, p1] = reduxGame();
      game.increaseOxygenLevel(p1, 2);
      const before = game.getOxygenLevel();
      game.increaseOxygenLevel(p1, -1);
      expect(game.getOxygenLevel()).eq(before - 1);
      const lowering = game.events.serialize().events.filter((e) => e.type === 'global-parameter-changed' &&
        (e.impact.globalParameter?.steps ?? 0) < 0);
      expect(lowering).has.length(1);
      expect(lowering[0].player, 'a PLAYER\'s own action is attributed to them').eq(p1.color);
    });

    it('the 8 % temperature bonus re-arms on the way back up — the engine\'s own rule, not a register of the card\'s', () => {
      const [game, p1] = reduxGame();
      for (let i = 0; i < 4; i++) {
        game.increaseOxygenLevel(p1, 2);
      }
      expect(game.getOxygenLevel()).eq(8);
      const afterFirst = game.getTemperature();
      expect(afterFirst, 'crossing 8 % raised the temperature once').eq(-28);
      game.increaseOxygenLevel(p1, -1);
      expect(game.getOxygenLevel()).eq(7);
      game.increaseOxygenLevel(p1, 1);
      expect(game.getOxygenLevel()).eq(8);
      expect(game.getTemperature(), 'the engine raises it again — the card keeps no register of its own').eq(-26);
    });
  });

  describe('recovery and the bot', () => {
    it('a reload INSIDE the enactment moves nothing twice', () => {
      const [game] = stage();
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      endGenerationThroughParliament(game);
      const live = reload(game);
      expect(live.getOxygenLevel()).eq(1);
      expect(live.getVenusScaleLevel()).eq(4);
      settleParliamentGates(live);
      // The whole sitting re-driven from the copy: the applied keys stand, nothing repeats.
      expect(live.getOxygenLevel()).eq(1);
      expect(live.getVenusScaleLevel()).eq(4);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === undefined && o.step === 'oxygen')).has.length(1);
      expect(outcomes.filter((o) => o.player === undefined && o.step === 'venus')).has.length(1);
    });

    it('MarsBot is never paid and the planet is shared: the world moves once for the table it sits at', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, GAS);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      game.increaseOxygenLevel(human, 2);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor(), 'the bot is never asked a political question').is.undefined;
      settleParliamentGates(game);
      expect(parliament.phase, 'nothing of this card asks anything — the sitting closes on its own').is.undefined;
      // The bot takes its own turns in the same generation, so the world's own move is read off the RECORD.
      expect(worldOutcome(parliament, 'oxygen')).deep.include({kind: 'globalParameter', amount: -1, unrewarded: true});
      expect(worldOutcome(parliament, 'venus')).deep.include({kind: 'globalParameter', amount: 2, unrewarded: true});
      const venus = worldOutcome(parliament, 'venus')?.parameter;
      expect((venus?.after ?? 0) - (venus?.before ?? 0), 'two steps, 2 % apiece').eq(4);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id), 'the bot is never a recipient here').is.false;
    });

    it('the model carries the world records to every client, with no seat on them', () => {
      const [game, p1, p2] = stage();
      game.increaseOxygenLevel(game.playersInGenerationOrder[0], 2);
      endGeneration(game);
      for (const viewer of [p1, p2]) {
        const outcomes = getParliamentModel(game, viewer)?.lastPhase?.outcomes ?? [];
        const world = outcomes.filter((o) => o.part === 'world');
        expect(world.map((o) => `${o.step}:${o.kind}:${o.amount}`), `viewer ${viewer.color}`)
          .deep.eq(['oxygen:globalParameter:-1', 'venus:globalParameter:2']);
        expect(world.every((o) => o.player === undefined), 'a world record names no seat on the wire').is.true;
      }
    });

    it('once enacted, the REDS rule', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      expect(parliament.rulingParty()).eq(PartyName.REDS);
      expect(parliament.hasPartyEffect(p1, PartyName.REDS)).is.true;
      expect(parliament.hasPartyEffect(p2, PartyName.REDS), 'the ruling party\'s effect is everyone\'s').is.true;
    });
  });
});
