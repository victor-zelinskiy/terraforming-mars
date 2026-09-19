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
import {scaledAmount, sequelAmount} from '../../src/common/parliament/influenceScaling';
import {OUTCOME_KINDS, REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {Color} from '../../src/common/Color';
import {ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '../../src/common/models/ParliamentModel';
import {RESOLUTION_FAMILIES, familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {sittingBeats} from '../../src/client/console/parliament/sittingBeats';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ResolutionDefinition} from '../../src/server/parliament/resolutions/IResolution';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
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
 *   8. THE STAND — the declaration alone yields a scenario family.
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
  // ONE fitting card for every family: an animal holder, a counted building, a power tag, a science tag.
  one: () => [new Fish(), new ArtificialLake(), new PowerPlant(), new Research()],
  saturated: () => [
    new Fish(), new Pets(), new Birds(), new Tardigrades(), new Trees(),
    new ArtificialLake(), new DomedCrater(), new SpaceElevator(), new Mine(),
    new HE3FusionPlant(), new PowerPlant(), new FusionPower(), new Research(),
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
      } else if (wf instanceof OrOptions) {
        player.process({type: 'or', index: 0, response: {type: 'option'}});
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

function checkReporting(definition: ResolutionDefinition, run: Run, condition: {influence: number; tableau: string}): Array<string> {
  const failures: Array<string> = [];
  for (const seat of run.seats) {
    for (const step of definition.immediateSteps ?? []) {
      const records = recordsOf(run, seat.id, step.key);
      if (records.length === 0) {
        failures.push(missingReport(definition, step.key, condition));
      } else if (records.length > 1) {
        failures.push(`${label(definition)}: шаг '${step.key}' отчитался ${records.length} раза (место ${seat.id}) при влиянии ${condition.influence} / таблице '${condition.tableau}'`);
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
    const own = outcomes.filter((o) => o.player === viewer && o.kind !== 'reaction');
    const beats = sittingBeats(summary, viewer, 'live').filter((b) => b.kind === 'reward');
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
      if (delivery.skipped !== undefined) {
        if (beat.skipped !== delivery.skipped) {
          failures.push(`${label(definition)}: бет пропуска '${outcome.step}' называет «${beat.skipped}», адрес — «${delivery.skipped}»`);
        }
        if (LOCALE[delivery.skipped] === undefined) {
          failures.push(`${label(definition)}: плита пропуска шага '${outcome.step}' не переведена: «${delivery.skipped}»`);
        }
      } else if (delivery.address.unit !== 'tile' && (delivery.payload.amount ?? 0) <= 0) {
        failures.push(`${label(definition)}: запись '${outcome.step}' (${outcome.kind}) без величины и без причины — тихая награда`);
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
        scaledAmount(effect, seat.influence, record.count ?? 0);
      if (expected === undefined) {
        failures.push(`${label(definition)}: последовательная часть '${effect.id}' не записала итог (total), из которого делила`);
        continue;
      }
      const paid = record.amount ?? 0;
      if (record.kind === 'skipped' ? (paid !== 0 && paid !== expected) : paid !== expected) {
        failures.push(`${label(definition)}: часть '${effect.id}' заплатила ${paid}, декларация даёт ${expected} (влияние ${seat.influence}, счёт ${record.count ?? 0})`);
      }
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
            failures.push(...checkReporting(definition, run, {influence, tableau}), ...checkKinds(definition, run), ...checkFormula(definition, run));
          }
        }
        expect(failures, failures.join('\n')).deep.eq([]);
      });

      it('1 · REPORTING: the winner\'s steps report once for the winner and never for another seat (influence 1 / 3 / 5)', () => {
        const failures: Array<string> = [];
        for (const influence of [1, 3, 5]) {
          const run = enact(definition, {influence, tableau: 'saturated', winner: 'player'});
          failures.push(...checkReporting(definition, run, {influence, tableau: 'saturated'}), ...checkKinds(definition, run), ...checkFormula(definition, run));
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
    });
  }

  describe('the development examples (never dealt) keep the same contract — reporting, kinds, formula, resume, locale, family', () => {
    for (const definition of DEV) {
      it(`${label(definition)}`, () => {
        const failures: Array<string> = [];
        for (const influence of [0, 3] as const) {
          for (const tableau of ['empty', 'saturated'] as const) {
            const run = enact(definition, {influence, tableau, winner: 'neutral'});
            failures.push(...checkReporting(definition, run, {influence, tableau}), ...checkKinds(definition, run), ...checkFormula(definition, run));
          }
        }
        const withWinner = enact(definition, {influence: 3, tableau: 'saturated', winner: 'player', reload: true});
        failures.push(...checkReporting(definition, withWinner, {influence: 3, tableau: 'saturated'}), ...checkResume(definition, withWinner));
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
   * THE TEST OF THE TEST — a planted BROKEN step. Not run (the catalog is the
   * engine's, and a definition outside it cannot be seated in a real game);
   * kept as the reference of what the guard says when an author forgets
   * `report()`: seat a copy of a dev example whose step grants and returns
   * without reporting, run `enact(...)`, and `checkReporting` answers with
   * «Reforestation Fund: шаг 'grant-mc' не отчитался при влиянии 0 / таблице
   * 'empty'» — the sentence pinned by the test above.
   */
  describe.skip('образец: сломанная резолюция (шаг без report) — что печатает гард', () => {
    it('shows the sentence with the card, the step and the condition', () => {
      const broken: ResolutionDefinition = {...DEV[0], immediateSteps: [{key: 'grant-mc', run: (ctx) => {
        ctx.player.megaCredits += 3;
        return undefined;
      }}]};
      const run = enact(broken, {influence: 0, tableau: 'empty', winner: 'neutral'});
      expect(checkReporting(broken, run, {influence: 0, tableau: 'empty'})).deep.eq([missingReport(broken, 'grant-mc', {influence: 0, tableau: 'empty'})]);
    });
  });
});
