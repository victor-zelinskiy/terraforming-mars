import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {PlayerInput} from '../../src/server/PlayerInput';
import {Phase} from '../../src/common/Phase';
import {PlayerId} from '../../src/common/Types';
import {AGENDA_TRACK, influenceAtAgenda} from '../../src/common/parliament/ParliamentTypes';
import {levelAfter, levelAmount, levelTakesAway, scaledAmount, sequelAmount} from '../../src/common/parliament/influenceScaling';
import {LEVY_STEP_KEY, levyDeclared, levyPaid} from '../../src/common/parliament/resolutionLevy';
import {OUTCOME_KINDS, REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {isWinnerParameterReward, winnerParameterStepKey} from '../../src/common/parliament/winnerReward';
import {parameterStepSize} from '../../src/common/parliament/parameterMove';
import {Color} from '../../src/common/Color';
import {ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '../../src/common/models/ParliamentModel';
import {RESOLUTION_FAMILIES, familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {sittingBeats} from '../../src/client/console/parliament/sittingBeats';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {hasImmediateSteps, hasWorldSteps, immediateStepsOf, ResolutionDefinition} from '../../src/server/parliament/resolutions/IResolution';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {Fish} from '../../src/server/cards/base/Fish';
import {Pets} from '../../src/server/cards/base/Pets';
import {Birds} from '../../src/server/cards/base/Birds';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {DomedCrater} from '../../src/server/cards/base/DomedCrater';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';
import {Mine} from '../../src/server/cards/base/Mine';
import {PowerPlant} from '../../src/server/cards/base/PowerPlant';
import {FusionPower} from '../../src/server/cards/base/FusionPower';
import {HE3FusionPlant} from '../../src/server/cards/moon/HE3FusionPlant';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Trees} from '../../src/server/cards/base/Trees';
import {Research} from '../../src/server/cards/base/Research';
import {Luna} from '../../src/server/colonies/Luna';
import {Callisto} from '../../src/server/colonies/Callisto';
import {runAllActions} from '../TestingUtils';
import {answerStandingGates, passToParliament, seatResolution, settleParliamentGates} from './parliamentArrange';

/*
 * THE RESOLUTION AUTHOR'S CONTRACT, ENFORCED OVER THE CATALOG (plan §5.4).
 *
 * This spec never names a resolution: it walks `REDUX_RESOLUTION_CATALOG` and
 * runs every entry through the REAL political phase on a three-seat table —
 * at several influences, on several tableaus, with a player and with a
 * neutral winner, with a reload inside every question — and reads what the
 * step machinery recorded. A resolution that ships without a row here is one
 * the sitting cannot present honestly; the failure names the card, the step
 * and the condition («RX05: шаг 'draw' не отчитался при влиянии 0 / таблице
 * 'empty'»), so the guard is the worklist for the next 43 cards.
 *
 * What the contract promises (docs/claude/parliament-resolution-checklist.md):
 *   1. REPORTING — every step reports exactly once per (seat, step); the
 *      winner's steps for the winner only; a neutral winner gets nothing;
 *   2. KINDS — every outcome kind has an address; every skip reason is a
 *      translated key;
 *   3. MARKERS — every prompt a step raises carries a structural source;
 *   4. RESUME — a reload inside any question rebuilds the same prompt and
 *      pays nothing twice;
 *   5. DECLARATION ↔ PAYOUT — the amount paid is the declared formula's;
 *   6. THE CLIENT KNOWS NO NAMES — no catalog id and no import of the
 *      resolutions' directory anywhere under src/client outside the manifest
 *      and the stand;
 *   7. FACE AND LOCALE — a non-empty face, translated texts, unique codes;
 *   8. THE STAND — the declaration alone yields a scenario family;
 *   9. THE SEAM — a passive declares its forecast, an action its preview, both
 *      their declaration text; a resolution with no immediate step still gives
 *      the sitting's REWARD stage an honest pose (`quietRewardPoseOf`).
 */

const ROOT = path.join(__dirname, '..', '..');
/** Every RU key the build aggregates (`make:json` merges the files): a text is translated when ANY file has it. */
const LOCALE: Record<string, string> = Object.assign({}, ...fs.readdirSync(path.join(ROOT, 'src', 'locales', 'ru'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'locales', 'ru', f), 'utf8')) as Record<string, string>));

const REAL = REDUX_RESOLUTION_CATALOG.all().filter((d) => d.copies > 0);
const DEV = REDUX_RESOLUTION_CATALOG.all().filter((d) => d.copies === 0);

const INFLUENCES = [0, 1, 3, 5] as const;
type TableauName = 'empty' | 'one' | 'saturated';
const TABLEAUS: Readonly<Record<TableauName, () => Array<IProjectCard>>> = {
  empty: () => [],
  // ONE fitting card for every family: an animal holder, a counted building, a power tag, a science tag,
  // a floater holder (with a Venus tag — the distributing family's ordinary pick: one holder takes all).
  one: () => [new Fish(), new ArtificialLake(), new PowerPlant(), new Research(), new Dirigibles()],
  // …and TWO floater holders, so the distributing family asks its DISTRIBUTION (N ≥ 2 over ≥ 2 holders).
  saturated: () => [
    new Fish(), new Pets(), new Birds(), new Tardigrades(), new Trees(),
    new ArtificialLake(), new DomedCrater(), new SpaceElevator(), new Mine(),
    new HE3FusionPlant(), new PowerPlant(), new FusionPower(), new Research(),
    new Dirigibles(), new AtmoCollectors(),
  ],
};

/** The printed code (a dev example has none: its name stands in). */
function label(definition: ResolutionDefinition): string {
  return definition.code ?? definition.text.name;
}

/** «RX05: шаг 'draw' не отчитался при влиянии 0 / таблице 'empty'» — the guard's own sentence (its shape is pinned below). */
export function missingReport(definition: {code?: string; text: {name: string}}, step: string, condition: {influence: number; tableau: string}): string {
  return `${label(definition as ResolutionDefinition)}: шаг '${step}' не отчитался при влиянии ${condition.influence} / таблице '${condition.tableau}'`;
}

/** The Agenda position that reads as influence `n` for a seat that takes NO Agenda step during the phase. */
function agendaFor(influence: number): number {
  for (let position = 0; position <= AGENDA_TRACK.length; position++) {
    if (influenceAtAgenda(position) === influence) {
      return position;
    }
  }
  throw new Error(`no Agenda position reads as influence ${influence}`);
}

type Marker = {choice?: unknown; placement?: unknown; draw?: unknown};

function markerOf(input: PlayerInput): Marker {
  return {
    choice: input.choiceContext?.source,
    placement: (input as {placementContext?: {source?: unknown}}).placementContext?.source,
    draw: input.externalDrawPrompt?.cause,
  };
}

function hasSource(marker: Marker): boolean {
  const choice = marker.choice as {kind?: string} | undefined;
  const draw = marker.draw as {kind?: string} | undefined;
  return choice?.kind === 'resolution' || marker.placement !== undefined || draw?.kind === 'resolution';
}

type SeenPrompt = {seat: PlayerId; type: string; marker: Marker; step: string | undefined; afterReload?: Marker};

type Run = {
  outcomes: ReadonlyArray<SerializedEnactOutcome>;
  prompts: ReadonlyArray<SeenPrompt>;
  seats: ReadonlyArray<{id: PlayerId; influence: number; winner: boolean}>;
  game: IGame;
};

/**
 * ONE ENACTMENT of `definition` on a three-seat Redux table, driven through
 * the real phase (the gates walked, every ask answered with its plainest
 * legal answer — every card of a take, the first candidate, the first cell,
 * the first branch). `winner: 'player'` seats the first seat's delegate on
 * the card (its Agenda step is part of the run: the seat is arranged one
 * position back, so it reads `influence` at the payout); `'neutral'` leaves
 * every seat at exactly `influence`. `reload` re-deserializes the game inside
 * EVERY question and goes on from the copy.
 */
function enact(definition: ResolutionDefinition, opts: {influence: number; tableau: TableauName; winner: 'player' | 'neutral'; reload?: boolean}): Run {
  const players = testGame(3, {turmoilReduxExpansion: true, coloniesExtension: true});
  let game: IGame = players[0];
  const seats = players.slice(1) as Array<TestPlayer>;
  game.phase = Phase.ACTION;
  // THE COLONY TABLE IS ARRANGED, never dealt: a winner's part may BUILD (Colony Contest), and a dealt tile's own
  // build bonus can ask a question of the ENGINE's (Europa's ocean, Titan's floater target — no resolution source, so
  // the marker check would blame the card). The contract is read over tiles whose bonus is a plain production step.
  game.colonies = [new Luna(), new Callisto()];
  const parliament = game.parliament!;
  seatResolution(parliament, 0, definition.id);
  const winner = opts.winner === 'player' ? seats[0] : undefined;
  for (const seat of seats) {
    seat.megaCredits = 20;
    seat.playedCards.push(...TABLEAUS[opts.tableau]());
    const position = seat === winner ? Math.max(0, agendaFor(opts.influence) - 1) : agendaFor(opts.influence);
    parliament.agenda.set(seat.id, position);
  }
  if (winner !== undefined) {
    if (opts.influence === 0) {
      throw new Error('a player winner reads influence 1 at least — its Agenda step comes first');
    }
    parliament.placeVote(winner, parliament.slots[0], 'lobby');
  } else {
    parliament.addNeutralVote(parliament.slots[0]);
  }
  runAllActions(game);
  passToParliament(game);
  answerStandingGates(game, 'assembly');
  const prompts: Array<SeenPrompt> = [];
  for (let round = 0; round < 40; round++) {
    let answered = false;
    for (const id of seats.map((s) => s.id)) {
      let player: IPlayer = game.getPlayerById(id);
      let wf = player.getWaitingFor();
      if (wf === undefined || wf.parliamentPhasePrompt !== undefined) {
        continue;
      }
      const seen: SeenPrompt = {seat: id, type: wf.type, marker: markerOf(wf), step: game.parliament!.phase?.effects?.pending?.key};
      if (opts.reload === true) {
        game = Game.deserialize(structuredClone(game.serialize()));
        player = game.getPlayerById(id);
        const rebuilt = player.getWaitingFor();
        if (rebuilt === undefined) {
          throw new Error(`${label(definition)}: a reload inside the '${seen.step}' question of ${player.color} lost the prompt`);
        }
        seen.afterReload = markerOf(rebuilt);
        wf = rebuilt;
      }
      prompts.push(seen);
      if (wf instanceof SelectCard) {
        const cards = wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name];
        player.process({type: 'card', cards});
      } else if (wf instanceof SelectSpace) {
        player.process({type: 'space', spaceId: wf.spaces[0].id});
      } else if (wf instanceof SelectColony) {
        // The winner's free colony (Colony Contest): the first tile the ordinary rules allow.
        player.process({type: 'colony', colonyName: wf.colonies[0].name});
      } else if (wf instanceof OrOptions) {
        player.process({type: 'or', index: 0, response: {type: 'option'}});
      } else if (wf instanceof AndOptions && wf.cardResourceDistributionPrompt !== undefined) {
        // A DISTRIBUTION (the shared step's marker): the plainest legal answer puts everything on the first holder.
        const amount = wf.cardResourceDistributionPrompt.amount;
        player.process({type: 'and', responses: wf.options.map((_, i) => ({type: 'amount', amount: i === 0 ? amount : 0}))});
      } else {
        throw new Error(`${label(definition)}: the guard cannot answer a "${wf.type}" prompt of ${player.color}`);
      }
      runAllActions(game);
      answered = true;
    }
    if (!answered) {
      break;
    }
  }
  settleParliamentGates(game);
  const finished = game.parliament!;
  if (finished.phase !== undefined) {
    throw new Error(`${label(definition)}: the phase did not finish (step ${finished.phase.step})`);
  }
  return {
    outcomes: finished.lastPhase?.outcomes ?? [],
    prompts,
    seats: seats.map((s) => ({id: s.id, influence: opts.influence, winner: s === winner})),
    game,
  };
}

/** The outcome records of `seat` for `step` that are the STEP's own (the ruling party's reaction is its own record). */
function recordsOf(run: Run, seat: PlayerId, step: string): Array<SerializedEnactOutcome> {
  return run.outcomes.filter((o) => o.player === seat && o.step === step && o.kind !== 'reaction');
}

/** The WORLD records of `step` — the ones that belong to no seat at all (`worldSteps`). */
function worldRecordsOf(run: Run, step: string): Array<SerializedEnactOutcome> {
  return run.outcomes.filter((o) => o.player === undefined && o.step === step);
}

function checkReporting(definition: ResolutionDefinition, run: Run, condition: {influence: number; tableau: string}): Array<string> {
  const failures: Array<string> = [];
  for (const seat of run.seats) {
    // The seat's OWN steps — the static list, or the definition's per-player PLAN re-derived over the run's table
    // (the plan is deterministic over the table, which the sitting never changes — the same keys the driver walked).
    const steps = immediateStepsOf(definition, run.game.getPlayerById(seat.id), run.game.parliament!, run.game);
    for (const step of steps) {
      const records = recordsOf(run, seat.id, step.key);
      if (records.length === 0) {
        failures.push(missingReport(definition, step.key, condition));
      } else if (records.length > 1) {
        failures.push(`${label(definition)}: шаг '${step.key}' отчитался ${records.length} раза (место ${seat.id}) при влиянии ${condition.influence} / таблице '${condition.tableau}'`);
      }
    }
    for (const step of definition.worldSteps ?? []) {
      if (recordsOf(run, seat.id, step.key).length !== 0) {
        failures.push(`${label(definition)}: мировой шаг '${step.key}' записан на место ${seat.id} — мировой ход не принадлежит никому`);
      }
    }
    for (const step of definition.winnerSteps ?? []) {
      const records = recordsOf(run, seat.id, step.key);
      if (seat.winner && records.length !== 1) {
        failures.push(`${label(definition)}: шаг победителя '${step.key}' дал ${records.length} записей вместо одной при влиянии ${condition.influence} / таблице '${condition.tableau}'`);
      }
      if (!seat.winner && records.length !== 0) {
        failures.push(`${label(definition)}: шаг победителя '${step.key}' отчитался у НЕ-победителя ${seat.id}`);
      }
    }
  }
  // A WORLD STEP runs ONCE PER ENACTMENT, whoever won (a neutral winner
  // included): exactly one record, and it names no seat.
  for (const step of definition.worldSteps ?? []) {
    const records = worldRecordsOf(run, step.key);
    if (records.length !== 1) {
      failures.push(`${label(definition)}: мировой шаг '${step.key}' дал ${records.length} мировых записей вместо одной при влиянии ${condition.influence} / таблице '${condition.tableau}'`);
    }
    if (records.some((o) => o.part !== 'world')) {
      failures.push(`${label(definition)}: мировая запись шага '${step.key}' не помечена частью 'world'`);
    }
  }
  return failures;
}

/**
 * THE SEAM (final polish D.4) — the effects framework's honesty law on the parliament's own declarations:
 * a passive with no forecast twin and an action with no preview are silent lies in the play / action forecast;
 * a passive / action without its declaration text has nothing for the sitting to read; and a resolution with NO
 * immediate step and no passive / action would leave the sitting's REWARD stage empty (the stage reads the
 * passive or names the action's address — `quietRewardPoseOf` in `consoleSittingFlow.ts`).
 */
function checkSeam(definition: ResolutionDefinition): Array<string> {
  const failures: Array<string> = [];
  const name = label(definition);
  if (definition.passive !== undefined && typeof definition.passive.forecast !== 'function') {
    failures.push(`${name}: a passive without a forecast`);
  }
  // …and a TILE passive without its dossier twin lets the placement panel promise less than the commit pays.
  if (definition.passive?.onTilePlaced !== undefined && typeof definition.passive.placementFacts !== 'function') {
    failures.push(`${name}: a tile passive without its dossier twin (placementFacts)`);
  }
  if (definition.action !== undefined && typeof definition.action.preview !== 'function') {
    failures.push(`${name}: an action without a preview`);
  }
  if (definition.passive !== undefined && (definition.text.passive ?? '') === '') {
    failures.push(`${name}: a passive without its declaration text (the REWARD stage reads it)`);
  }
  if (definition.action !== undefined && (definition.text.action ?? '') === '') {
    failures.push(`${name}: an action without its declaration text (the REWARD stage reads it)`);
  }
  // THE WORLD'S PART is declared on THREE layers or on none: the data every
  // surface reads (`worldMoves`), the steps that pay it, and the sentence the
  // inspector prints. Two of the three is a card whose reading and whose
  // payout can drift apart.
  const worldMoves = (definition.worldMoves ?? []).length > 0;
  if (worldMoves !== hasWorldSteps(definition)) {
    failures.push(`${name}: worldMoves and worldSteps must be declared together (the reading and the payout are one declaration)`);
  }
  if (worldMoves && (definition.text.world ?? '') === '') {
    failures.push(`${name}: a world part without its declaration text (the inspector reads it)`);
  }
  // THE LEVY is declared on TWO layers or on none: the data every surface reads (`levy`) and the family's
  // shared step, FIRST in the seat's own steps (the printed order is the executed order).
  const steps = definition.immediateSteps ?? [];
  const levyAt = steps.findIndex((step) => step.key === LEVY_STEP_KEY);
  if (definition.levy !== undefined && !levyDeclared(definition.levy)) {
    failures.push(`${name}: a levy must be a positive whole sum to every participant`);
  }
  if ((definition.levy !== undefined) !== (levyAt >= 0)) {
    failures.push(`${name}: levy and the levy step must be declared together (the reading and the take are one declaration)`);
  }
  if (levyAt > 0) {
    failures.push(`${name}: the levy step must come FIRST — the printed order is the executed order`);
  }
  const immediate = (hasImmediateSteps(definition) ? 1 : 0) + (definition.worldSteps ?? []).length + (definition.winnerSteps ?? []).length;
  if (immediate === 0 && definition.passive === undefined && definition.action === undefined) {
    failures.push(`${name}: no immediate step, no passive, no action — the REWARD stage would be empty`);
  }
  // THE WINNER'S PARAMETER STEP (Mohole Contest) is declared on TWO layers or on none: the data every surface
  // reads (`winnerReward: {kind: 'parameter'}`) and the family's SHARED step under the key the declaration
  // derives (`winnerParameterStepKey`) — a card that pays a direct step by a step of its own would be the second
  // executor the declaration exists to prevent. The sentence (`text.winner`) rides with it.
  const reward = definition.winnerReward;
  const winnerKeys = (definition.winnerSteps ?? []).map((step) => step.key);
  if (reward !== undefined && isWinnerParameterReward(reward)) {
    if (!Number.isInteger(reward.steps) || reward.steps <= 0) {
      failures.push(`${name}: a winner parameter step must ask for a positive whole number of steps`);
    }
    if (!winnerKeys.includes(winnerParameterStepKey(reward))) {
      failures.push(`${name}: winnerReward {kind: 'parameter'} without its shared step '${winnerParameterStepKey(reward)}' in winnerSteps (the reading and the payout are one declaration)`);
    }
    if ((definition.text.winner ?? '') === '') {
      failures.push(`${name}: a winner parameter step without its declaration text (the inspector reads it)`);
    }
  }
  return failures;
}

function checkKinds(definition: ResolutionDefinition, run: Run): Array<string> {
  const failures: Array<string> = [];
  for (const o of run.outcomes) {
    if (!(OUTCOME_KINDS as ReadonlyArray<string>).includes(o.kind)) {
      failures.push(`${label(definition)}: шаг '${o.step}' записал kind '${o.kind}', которого нет в rewardAddress.ts`);
    }
    if (o.kind === 'skipped') {
      if (o.reason === undefined) {
        failures.push(`${label(definition)}: шаг '${o.step}' пропущен без причины`);
      } else if (LOCALE[o.reason] === undefined) {
        failures.push(`${label(definition)}: причина пропуска «${o.reason}» шага '${o.step}' не переведена (src/locales/ru)`);
      }
    }
  }
  failures.push(...checkNoSilentReward(definition, run));
  failures.push(...checkWinnerParameterRecord(definition, run));
  return failures;
}

/**
 * THE WINNER'S PARAMETER STEP IS REWARDED, AND ITS RECORD IS THE ENGINE'S (Mohole Contest, RX23): the
 * winner's record of the shared step names the declared parameter, carries the steps ACTUALLY made
 * (before → after, in the parameter's own step size), is never flagged `unrewarded` (that is a WORLD
 * move's flag — a winner credited with nothing would be the trap the declaration exists to prevent),
 * and states the TR the step paid. A skip names its reason; a moving record names its rating.
 */
function checkWinnerParameterRecord(definition: ResolutionDefinition, run: Run): Array<string> {
  const failures: Array<string> = [];
  const reward = definition.winnerReward;
  if (reward === undefined || !isWinnerParameterReward(reward)) {
    return failures;
  }
  const key = winnerParameterStepKey(reward);
  for (const seat of run.seats.filter((s) => s.winner)) {
    for (const record of recordsOf(run, seat.id, key)) {
      if (record.kind !== 'globalParameter' && record.kind !== 'skipped') {
        failures.push(`${label(definition)}: запись шага победителя '${key}' имеет вид '${record.kind}' вместо globalParameter / skipped`);
        continue;
      }
      if (record.parameter?.id !== reward.parameter) {
        failures.push(`${label(definition)}: запись шага победителя '${key}' не называет параметр '${reward.parameter}'`);
        continue;
      }
      if (record.unrewarded === true) {
        failures.push(`${label(definition)}: шаг победителя '${key}' помечен unrewarded — победитель ЛИШЁН РТ (это флаг мирового хода, не награды)`);
      }
      const made = (record.parameter.after - record.parameter.before) / parameterStepSize(reward.parameter);
      if ((record.amount ?? 0) !== made) {
        failures.push(`${label(definition)}: запись шага победителя '${key}' несёт ${record.amount} шагов, параметр прошёл ${made}`);
      }
      if (made > reward.steps || made < 0) {
        failures.push(`${label(definition)}: шаг победителя '${key}' прошёл ${made} шагов при объявленных ${reward.steps}`);
      }
      if (record.kind === 'globalParameter' && (record.tr === undefined || record.tr < made)) {
        failures.push(`${label(definition)}: запись шага победителя '${key}' не несёт РТ победителя (tr ${record.tr}) при ${made} сделанных шагах`);
      }
    }
  }
  return failures;
}

/**
 * NO SILENT REWARD (plan §4, Э5): every record a seat receives becomes exactly
 * ONE beat of the sitting director with an ADDRESS — a place the player sees
 * it land, and for a skip (or a paying kind that paid nothing) a NAMED,
 * translated reason on the stage plate. The sitting's beat list is the pure
 * client module (`sittingBeats`) over the summary shape the server ships; the
 * outcomes are the run's own records, so a resolution that pays a kind the
 * director cannot present fails here, by card and step.
 */
function checkNoSilentReward(definition: ResolutionDefinition, run: Run): Array<string> {
  const failures: Array<string> = [];
  const outcomes = run.outcomes as unknown as Array<ParliamentEnactOutcomeModel>;
  const summary = {
    generation: 1, final: false, support: [], refreshed: [], lobbyRefilled: [], outcomes,
    winner: {instance: `${definition.id}#0`, resolution: definition.id, party: definition.party, votes: 1},
    enacted: {instance: `${definition.id}#0`, resolution: definition.id, party: definition.party},
  } as unknown as ParliamentPhaseSummaryModel;
  for (const seat of run.seats) {
    const viewer = seat.id as unknown as Color;
    // A WORLD record belongs to no seat and is played by EVERY viewer: it is
    // the seat's beat list too, and it must never be silent either.
    const own = outcomes.filter((o) => (o.player === viewer || o.player === undefined) && o.kind !== 'reaction');
    const beats = sittingBeats(summary, viewer, 'live').filter((b) => b.kind === 'reward' || b.kind === 'world');
    if (beats.length !== own.length) {
      failures.push(`${label(definition)}: у места ${seat.id} ${own.length} записей, но ${beats.length} бетов награды — запись без бета (тихая награда)`);
    }
    for (const beat of beats) {
      const outcome = beat.outcome;
      if (outcome === undefined) {
        failures.push(`${label(definition)}: бет награды без записи`);
        continue;
      }
      const delivery = rewardAddressOf(outcome, viewer);
      if (!delivery.mine) {
        failures.push(`${label(definition)}: адрес записи '${outcome.step}' не считает её записью места ${seat.id}`);
      }
      if (beat.kind === 'world' && outcome.player !== undefined) {
        failures.push(`${label(definition)}: мировой бет играет запись места ${outcome.player}`);
      }
      if (delivery.skipped !== undefined) {
        if (beat.skipped !== delivery.skipped) {
          failures.push(`${label(definition)}: бет пропуска '${outcome.step}' называет «${beat.skipped}», адрес — «${delivery.skipped}»`);
        }
        if (LOCALE[delivery.skipped] === undefined) {
          failures.push(`${label(definition)}: плита пропуска шага '${outcome.step}' не переведена: «${delivery.skipped}»`);
        }
      } else if (delivery.address.unit !== 'tile' && (delivery.payload.amount ?? 0) === 0) {
        // A NEGATIVE amount is a LOSS the seat suffered (a levy) — a payout read with its sign, never «nothing».
        failures.push(`${label(definition)}: запись '${outcome.step}' (${outcome.kind}) без величины и без причины — тихая награда`);
      } else if (delivery.direction === 'loss' && (outcome.owed === undefined || outcome.owed < -(outcome.amount ?? 0))) {
        failures.push(`${label(definition)}: потеря '${outcome.step}' (${outcome.amount}) не несёт «было должно» (owed) не меньше взятого`);
      }
    }
  }
  return failures;
}

function checkFormula(definition: ResolutionDefinition, run: Run): Array<string> {
  const failures: Array<string> = [];
  for (const effect of definition.scaled ?? []) {
    for (const seat of run.seats) {
      if (effect.recipient === 'winner' && !seat.winner) {
        continue;
      }
      const record = run.outcomes.find((o) => o.player === seat.id && o.effect === effect.id && o.kind !== 'reaction');
      if (record === undefined) {
        failures.push(`${label(definition)}: у части '${effect.id}' нет записи для места ${seat.id} при влиянии ${seat.influence}`);
        continue;
      }
      if (record.influence !== seat.influence) {
        failures.push(`${label(definition)}: часть '${effect.id}' записала влияние ${record.influence}, стол давал ${seat.influence}`);
      }
      const expected = effect.sequel !== undefined ?
        (record.total === undefined ? undefined : sequelAmount(effect, record.total.after)) :
        effect.level !== undefined ?
          (record.total === undefined ? undefined : levelAmount(effect, seat.influence, record.total.before)) :
          scaledAmount(effect, seat.influence, record.count ?? 0);
      if (expected === undefined) {
        failures.push(effect.level !== undefined ?
          `${label(definition)}: часть-порог '${effect.id}' не записала уровень (total), от которого считала величину` :
          `${label(definition)}: последовательная часть '${effect.id}' не записала итог (total), из которого делила`);
        continue;
      }
      if (effect.level !== undefined) {
        // A LEVEL part records the TARGET it brought the seat to — the formula's own number — beside the level:
        // a reading that had to recompute it from a later influence would be the lie the declaration exists to prevent.
        if (record.target !== scaledAmount(effect, seat.influence)) {
          failures.push(`${label(definition)}: часть-порог '${effect.id}' записала цель ${record.target}, декларация даёт ${scaledAmount(effect, seat.influence)} (влияние ${seat.influence})`);
        }
        // …and the LEVEL IT LEFT: the direction applied ONCE. A cut that recorded `after` above `before`
        // (or a top-up below it) would read as the opposite law in every surface downstream.
        const after = record.total === undefined ? undefined : levelAfter(effect, record.total.before, expected);
        if (record.total !== undefined && record.total.after !== after) {
          failures.push(`${label(definition)}: часть-порог '${effect.id}' записала уровень после ${record.total.after}, направление '${effect.level.direction}' даёт ${after}`);
        }
      }
      // A COLONY-BONUSES effect declares the MULTIPLIER: every record of the plan pays its own unit (2k M€, k
      // floaters, one card) and carries `multiplier: k` beside it — that is the declaration's number.
      // A CUT records its magnitude NEGATIVE (the address reads the sign): the declaration's number is its size.
      const paid = effect.unit.kind === 'colonyBonuses' ? (record.multiplier ?? record.amount ?? 0) :
        levelTakesAway(effect) ? -(record.amount ?? 0) : (record.amount ?? 0);
      if (record.kind === 'skipped' ? (paid !== 0 && paid !== expected) : paid !== expected) {
        failures.push(`${label(definition)}: часть '${effect.id}' заплатила ${paid}, декларация даёт ${expected} (влияние ${seat.influence}, счёт ${record.count ?? 0})`);
      }
    }
  }
  return failures;
}

/**
 * THE LEVY (the Budgets): a declared levy is paid by the family's ONE step, FIRST, for every seat — a `stock`
 * record with the negative amount actually taken and `owed` = the declared sum (`levyPaid` bounds the take
 * by the seat's supply; the guard's seats hold 20, so the whole sum is taken), or a `skipped` with the same
 * `owed` when the seat held nothing. Never a positive amount, never a record without `owed`.
 */
function checkLevy(definition: ResolutionDefinition, run: Run): Array<string> {
  const failures: Array<string> = [];
  const levy = definition.levy;
  if (levy === undefined) {
    return failures;
  }
  for (const seat of run.seats) {
    const record = recordsOf(run, seat.id, LEVY_STEP_KEY)[0];
    if (record === undefined) {
      failures.push(`${label(definition)}: плата не записана для места ${seat.id} при влиянии ${seat.influence}`);
      continue;
    }
    if (record.owed !== levy.amount) {
      failures.push(`${label(definition)}: запись платы несёт owed ${record.owed}, декларация даёт ${levy.amount}`);
    }
    if (record.stock !== levy.resource) {
      failures.push(`${label(definition)}: запись платы названа в ${record.stock}, декларация берёт ${levy.resource}`);
    }
    const taken = record.kind === 'skipped' ? 0 : -(record.amount ?? 0);
    const held = record.before ?? (record.kind === 'skipped' ? 0 : undefined);
    if (record.kind === 'stock' && (record.amount ?? 0) >= 0) {
      failures.push(`${label(definition)}: плата записана величиной ${record.amount} — потеря обязана быть отрицательной`);
    }
    if (held !== undefined && taken !== levyPaid(levy, held)) {
      failures.push(`${label(definition)}: плата взяла ${taken} при запасе ${held}, арифметика семейства даёт ${levyPaid(levy, held)}`);
    }
    if (record.kind === 'stock' && record.before !== undefined && record.after !== undefined && record.before - record.after !== taken) {
      failures.push(`${label(definition)}: запас ${record.before} → ${record.after} не сходится со взятым ${taken}`);
    }
  }
  return failures;
}

function checkMarkers(definition: ResolutionDefinition, run: Run): Array<string> {
  return run.prompts.filter((p) => !hasSource(p.marker))
    .map((p) => `${label(definition)}: промпт '${p.type}' шага '${p.step}' без структурного маркера источника (choiceContext.source / placementContext.source / externalDrawPrompt.cause)`);
}

function checkResume(definition: ResolutionDefinition, run: Run): Array<string> {
  const failures: Array<string> = [];
  for (const p of run.prompts) {
    if (p.afterReload !== undefined && JSON.stringify(p.afterReload) !== JSON.stringify(p.marker)) {
      failures.push(`${label(definition)}: после reload внутри шага '${p.step}' промпт несёт другой маркер: ${JSON.stringify(p.afterReload)} ≠ ${JSON.stringify(p.marker)}`);
    }
  }
  return failures;
}

/** Walk `src/client` for files that name a resolution or import the resolutions' directory — outside the manifest and the stand. */
function clientNameLeaks(ids: ReadonlyArray<string>): Array<string> {
  const ALLOWED = new Set(['src/client/parliament/ClientParliamentManifest.ts', 'src/client/components/console/parliament/ConsoleResolutionsPlayground.vue']);
  const leaks: Array<string> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|vue)$/.test(entry.name)) {
        continue;
      }
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (ALLOWED.has(rel)) {
        continue;
      }
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) {
          return;
        }
        if (/from '[^']*server\/parliament\/resolutions/.test(code)) {
          leaks.push(`${rel}:${index + 1} imports the resolutions' directory`);
        }
        for (const id of ids) {
          if (code.includes(id)) {
            leaks.push(`${rel}:${index + 1} names ${id}`);
          }
        }
      });
    }
  };
  walk(path.join(ROOT, 'src', 'client'));
  return leaks;
}

describe('ResolutionContract — the author\'s contract over the catalog', () => {
  it('walks a non-empty catalog (anti-vacuity)', () => {
    expect(REAL.length).to.be.greaterThanOrEqual(5);
    expect(DEV.length).to.be.greaterThanOrEqual(1);
  });

  it('the guard\'s own sentence names the card, the step and the condition', () => {
    expect(missingReport({code: 'RX05', text: {name: 'Climate Research'}}, 'draw', {influence: 0, tableau: 'empty'}))
      .eq('RX05: шаг \'draw\' не отчитался при влиянии 0 / таблице \'empty\'');
  });

  for (const definition of REAL) {
    describe(`${label(definition)} · ${definition.text.name}`, () => {
      it('1 · REPORTING: every immediate step reports once per seat at influence 0 / 1 / 3 / 5 on an empty, a one-card and a saturated tableau; a neutral winner gets no winner step', () => {
        const failures: Array<string> = [];
        for (const influence of INFLUENCES) {
          for (const tableau of Object.keys(TABLEAUS) as Array<TableauName>) {
            const run = enact(definition, {influence, tableau, winner: 'neutral'});
            failures.push(...checkReporting(definition, run, {influence, tableau}), ...checkKinds(definition, run), ...checkFormula(definition, run), ...checkLevy(definition, run));
          }
        }
        expect(failures, failures.join('\n')).deep.eq([]);
      });

      it('1 · REPORTING: the winner\'s steps report once for the winner and never for another seat (influence 1 / 3 / 5)', () => {
        const failures: Array<string> = [];
        for (const influence of [1, 3, 5]) {
          const run = enact(definition, {influence, tableau: 'saturated', winner: 'player'});
          failures.push(...checkReporting(definition, run, {influence, tableau: 'saturated'}), ...checkKinds(definition, run), ...checkFormula(definition, run), ...checkLevy(definition, run));
        }
        expect(failures, failures.join('\n')).deep.eq([]);
      });

      it('3 · MARKERS and 4 · RESUME: every prompt carries a structural source, survives a reload inside the question with the same marker, and nothing is paid twice', () => {
        const run = enact(definition, {influence: 3, tableau: 'saturated', winner: 'player', reload: true});
        const failures = [...checkMarkers(definition, run), ...checkResume(definition, run), ...checkReporting(definition, run, {influence: 3, tableau: 'saturated'})];
        expect(failures, failures.join('\n')).deep.eq([]);
        expect(run.game.parliament!.phase, 'the phase closed on the reloaded game').is.undefined;
      });

      it('7 · FACE AND LOCALE: a non-empty face, every text translated, a unique printed code', () => {
        expect(definition.renderData.rows.length, 'the face has rows').to.be.greaterThan(0);
        for (const [field, text] of Object.entries(definition.text)) {
          if (text !== undefined) {
            expect(LOCALE[text], `text.${field} «${text}» has a RU translation`).is.not.undefined;
          }
        }
        expect(definition.code, 'a real resolution prints its code').is.not.undefined;
        expect(REAL.filter((d) => d.code === definition.code)).has.length(1);
      });

      it('8 · THE STAND: the declaration alone yields a scenario family', () => {
        expect(RESOLUTION_FAMILIES).includes(familyOf(definition));
      });

      it('9 · THE SEAM: a passive declares its forecast, an action its preview; no immediate step still leaves the REWARD stage an honest pose', () => {
        const failures = checkSeam(definition);
        expect(failures, failures.join('\n')).deep.eq([]);
      });
    });
  }

  describe('the development examples (never dealt) keep the same contract — reporting, kinds, formula, resume, locale, family', () => {
    for (const definition of DEV) {
      it(`${label(definition)}`, () => {
        const failures: Array<string> = [];
        for (const influence of [0, 3] as const) {
          for (const tableau of ['empty', 'saturated'] as const) {
            const run = enact(definition, {influence, tableau, winner: 'neutral'});
            failures.push(...checkReporting(definition, run, {influence, tableau}), ...checkKinds(definition, run), ...checkFormula(definition, run), ...checkLevy(definition, run));
          }
        }
        const withWinner = enact(definition, {influence: 3, tableau: 'saturated', winner: 'player', reload: true});
        failures.push(...checkReporting(definition, withWinner, {influence: 3, tableau: 'saturated'}), ...checkResume(definition, withWinner));
        failures.push(...checkSeam(definition));
        expect(failures, failures.join('\n')).deep.eq([]);
        expect(definition.renderData.rows.length).to.be.greaterThan(0);
        for (const [field, text] of Object.entries(definition.text)) {
          if (text !== undefined) {
            expect(LOCALE[text], `text.${field} «${text}» has a RU translation`).is.not.undefined;
          }
        }
        expect(RESOLUTION_FAMILIES).includes(familyOf(definition));
      });
    }
  });

  it('2 · KINDS: the address table and the outcome union are one set', () => {
    expect(Object.keys(REWARD_ADDRESS).sort()).deep.eq([...OUTCOME_KINDS].sort());
  });

  it('6 · THE CLIENT KNOWS NO NAMES: no catalog id and no import of the resolutions\' directory under src/client outside the manifest and the stand', () => {
    const leaks = clientNameLeaks(REDUX_RESOLUTION_CATALOG.all().map((d) => d.id));
    expect(leaks, leaks.join('\n')).deep.eq([]);
  });

  /*
   * THE TEST OF THE TEST — what the guard says when an author forgets `report()`
   * is pinned by the `missingReport` unit test above («Reforestation Fund: шаг
   * 'grant-mc' не отчитался при влиянии 0 / таблице 'empty'»). A planted broken
   * definition cannot be SEATED in a real game (the catalog is the engine's), so
   * there is no skipped sample here — a skipped test is a promise nobody keeps
   * (Э9: no `describe.skip` / `test.skip` in the parliament trees).
   */
});
