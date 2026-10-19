import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard, isIActionCard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Phase} from '../../src/common/Phase';
import {Behavior} from '../../src/server/behavior/Behavior';
import {IGame} from '../../src/server/IGame';
import {PlayerInput} from '../../src/server/PlayerInput';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {Payment} from '../../src/common/inputs/Payment';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {TileType, GREENERY_TILES, OCEAN_TILES} from '../../src/common/TileType';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {DIVERTED_RESEARCH_ID} from '../../src/server/parliament/resolutions/reds/DivertedResearch';
import {divertedNetCatches, resetDivertedNet} from '../../src/server/parliament/resolutions/DivertedTerraforming';
import {Supercomputer} from '../../src/server/cards/turmoilRedux/Supercomputer';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';

/*
 * THE REPLACING LAW, SWEPT OVER THE WHOLE SCOPE (Turmoil Redux RX35 Diverted Research — invariant 11: a guard is
 * the worklist).
 *
 * Under the enacted law, with a data holder on the table, every in-scope card whose PLAY or ACTION raises oxygen or
 * temperature, places an ocean or a greenery — declared (`behavior` / `actionBehavior`) or bespoke (the card's source
 * reaches for `PlaceGreeneryTile` / `PlaceOceanTile` / `increaseOxygenLevel` / `increaseTemperature` / `addGreenery`
 * / `addOcean` / `createMarsSelectSpace`) — is walked for real, its prompts answered the cheapest valid way, and the
 * law's contract is asserted on each:
 *  · the scales never ROSE for the seat (a lowering is allowed — TR47's fall) and no greenery / ocean tile landed;
 *  · no cell was ever asked for a greenery or an ocean (a city's cell may be);
 *  · the «where» was asked AT MOST ONCE per operation (decision Р4), and — for a declared card — for exactly the
 *    PRINTED units (Р3), which then landed on the holder;
 *  · the engine's net caught nothing (every door diverted before its seating).
 * A card the walk cannot drive (a prompt the guard cannot synthesize, a play that throws for want of a table state
 * — a hazard to protect, a colony to build on) is reported as INFO, never as a failure.
 *
 * `LEFTOVER_DIVERT_WORKLIST` is EMPTY ON PURPOSE and fails BOTH ways: a new leak is a regression, a fixed entry must
 * be removed.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);
const LEFTOVER_DIVERT_WORKLIST = new Set<string>([]);

const DIVERTED = resolutionInstanceId(DIVERTED_RESEARCH_ID, 0);

/** The module key → source directory (two differ: `ceo` ↔ `ceos`, `deltaProject` ↔ `delta`). */
function dirOf(module: GameModule): string {
  if (module === 'ceo') {
    return 'ceos';
  }
  if (module === 'deltaProject') {
    return 'delta';
  }
  return module;
}

/** The source text of every card class in scope, by class name (read once). */
const SOURCE_BY_CLASS = new Map<string, string>();
for (const module of SCOPE) {
  const dir = path.join(__dirname, '../../src/server/cards', dirOf(module));
  if (!fs.existsSync(dir)) {
    continue;
  }
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, {withFileTypes: true})) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/export class (\w+)/g)) {
          SOURCE_BY_CLASS.set(m[1], text);
        }
      }
    }
  };
  walk(dir);
}

const BESPOKE_DOOR = /PlaceGreeneryTile|PlaceOceanTile|increaseOxygenLevel|increaseTemperature|addGreenery\(|addOcean\(|createMarsSelectSpace\(/;

/** The PRINTED units a behavior declares — what the law takes (its oceans a tile, its greenery one, Venus nobody's). */
function printedUnits(behavior: Behavior | undefined): number {
  if (behavior === undefined) {
    return 0;
  }
  // A colony the play builds may pay an ocean of its own (Europa) — the printed count cannot be read statically.
  if (behavior.colonies?.buildColony !== undefined) {
    return 0;
  }
  let units = 0;
  units += Math.max(0, behavior.global?.oxygen ?? 0);
  units += Math.max(0, behavior.global?.temperature ?? 0);
  units += behavior.ocean !== undefined ? (behavior.ocean.count ?? 1) : 0;
  units += behavior.greenery !== undefined ? 1 : 0;
  return units;
}

type Candidate = {Factory: new () => ICard, module: GameModule, name: CardName, play: number, action: number, bespoke: boolean};

function candidates(): Array<Candidate> {
  const out: Array<Candidate> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined) {
          continue;
        }
        let probe: ICard;
        try {
          probe = new Factory();
        } catch {
          continue;
        }
        const play = printedUnits(probe.behavior);
        const action = printedUnits(probe.actionBehavior);
        const text = SOURCE_BY_CLASS.get(Factory.name) ?? '';
        const bespoke = BESPOKE_DOOR.test(text);
        if (play > 0 || action > 0 || bespoke) {
          out.push({Factory, module: manifest.module, name: probe.name, play, action, bespoke});
        }
      }
    }
  }
  return out;
}

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, holder: Supercomputer};

function table(name: CardName): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  game.parliament!.enacted = DIVERTED;
  const holder = new Supercomputer();
  if (name !== CardName.SUPERCOMPUTER) {
    player.playedCards.push(holder);
  }
  player.megaCredits = 200;
  player.steel = 20;
  player.titanium = 20;
  player.plants = 20;
  player.energy = 20;
  player.heat = 40;
  opponent.megaCredits = 20;
  opponent.plants = 10;
  return {game, player, opponent, holder};
}

type Walk = {where: Array<number>, greeneryOrOceanCell: boolean, unwalkable?: string};

/** The cheapest valid answer of a live input — undefined when the guard cannot synthesize one. */
function answerOf(input: PlayerInput, walk: Walk): InputResponse | undefined {
  if (input instanceof SelectSpace) {
    const tile = (input as {tileType?: TileType}).tileType;
    if (tile !== undefined && (GREENERY_TILES.has(tile) || OCEAN_TILES.has(tile))) {
      walk.greeneryOrOceanCell = true;
    }
    return input.spaces.length > 0 ? {type: 'space', spaceId: input.spaces[0].id} : undefined;
  }
  if (input instanceof OrOptions) {
    for (let i = 0; i < input.options.length; i++) {
      const inner = answerOf(input.options[i], walk);
      if (inner !== undefined) {
        return {type: 'or', index: i, response: inner};
      }
    }
    return undefined;
  }
  if (input instanceof AndOptions) {
    const responses: Array<InputResponse> = [];
    for (const option of input.options) {
      const inner = answerOf(option, walk);
      if (inner === undefined) {
        return undefined;
      }
      responses.push(inner);
    }
    return {type: 'and', responses};
  }
  if (input instanceof SelectOption) {
    return {type: 'option'};
  }
  if (input instanceof SelectCard) {
    const cards = (input as SelectCard<ICard>).cards;
    if (input.resourceGainPrompt?.diverted !== undefined) {
      walk.where.push(input.resourceGainPrompt.amount ?? 0);
    }
    const n = Math.max(input.config.min, Math.min(1, input.config.max));
    if (cards.length < n) {
      return n === 0 ? {type: 'card', cards: []} : undefined;
    }
    return {type: 'card', cards: cards.slice(0, n).map((c) => c.name)};
  }
  if (input instanceof SelectAmount) {
    return {type: 'amount', amount: input.min};
  }
  if (input instanceof SelectPlayer) {
    return input.players.length > 0 ? {type: 'player', player: input.players[0].color} : undefined;
  }
  if (input instanceof SelectPayment) {
    return {type: 'payment', payment: Payment.of({megacredits: input.amount})};
  }
  if (input instanceof SelectColony) {
    return input.colonies.length > 0 ? {type: 'colony', colonyName: input.colonies[0].name} : undefined;
  }
  if (input instanceof SelectParty) {
    return input.parties.length > 0 ? {type: 'party', partyName: input.parties[0]} : undefined;
  }
  return undefined;
}

/** Drive the seat's prompts to the end (or to an answer the guard cannot give). */
function walkPrompts(t: Table, walk: Walk): void {
  for (let round = 0; round < 16; round++) {
    runAllActions(t.game);
    const input = t.player.getWaitingFor();
    if (input === undefined) {
      return;
    }
    const response = answerOf(input, walk);
    if (response === undefined) {
      walk.unwalkable = `a ${input.type} prompt the guard cannot answer`;
      return;
    }
    try {
      t.player.process(response);
    } catch (e) {
      walk.unwalkable = `answering a ${input.type} threw: ${(e as Error).message}`;
      return;
    }
  }
}

type Verdict = {failure?: string, info?: string};

function judge(t: Table, walk: Walk, label: string, printed: number, before: {oxygen: number, temperature: number, oceans: number}): Verdict {
  const problems: Array<string> = [];
  const game = t.game;
  if (game.getOxygenLevel() > before.oxygen) {
    problems.push(`the oxygen ROSE ${before.oxygen} → ${game.getOxygenLevel()}`);
  }
  if (game.getTemperature() > before.temperature) {
    problems.push(`the temperature ROSE ${before.temperature} → ${game.getTemperature()}`);
  }
  if (game.board.getOceanSpaces().length > before.oceans) {
    problems.push('an ocean tile landed');
  }
  if (game.board.spaces.some((s) => s.player === t.player && s.tile !== undefined && GREENERY_TILES.has(s.tile.tileType))) {
    problems.push('a greenery tile landed');
  }
  if (walk.greeneryOrOceanCell) {
    problems.push('a cell was asked for a greenery / ocean');
  }
  if (walk.where.length > 1) {
    problems.push(`the «where» was asked ${walk.where.length} times (${walk.where.join(', ')})`);
  }
  if (divertedNetCatches() > 0) {
    problems.push(`the engine's net caught ${divertedNetCatches()} unit(s) — an entry is missing`);
  }
  if (printed > 0 && walk.unwalkable === undefined) {
    if (walk.where.length === 0) {
      problems.push(`the ${printed} printed unit(s) raised no «where»`);
    } else if (walk.where[0] !== printed) {
      problems.push(`the «where» asked for ${walk.where[0]} data, the card prints ${printed} unit(s)`);
    } else {
      // What the LAW landed (its own source on the landing) — a card's own data beside it is the card's.
      const landed = game.events.events
        .filter((e) => e.type === 'card-resource-changed' && e.source?.kind === 'resolution' && e.source.id === DIVERTED_RESEARCH_ID)
        .reduce((sum, e) => sum + (e.impact.cardResources ?? []).reduce((s, r) => s + r.amount, 0), 0);
      if (landed !== printed) {
        problems.push(`${printed} data were promised, the law landed ${landed}`);
      }
    }
  }
  if (problems.length > 0) {
    return {failure: `${label} :: ${problems.join('; ')}`};
  }
  if (walk.unwalkable !== undefined) {
    return {info: `${label} :: ${walk.unwalkable}`};
  }
  return {};
}

function snapshot(game: IGame) {
  return {oxygen: game.getOxygenLevel(), temperature: game.getTemperature(), oceans: game.board.getOceanSpaces().length};
}

describe('DivertedResearch — the sweep over the scope (the worklist)', () => {
  it('every in-scope card that raises oxygen / temperature or places a greenery / ocean obeys the law on its PLAY and on its ACTION', () => {
    const leaking = new Map<string, string>();
    const infos: Array<string> = [];
    let walked = 0;
    for (const c of candidates()) {
      const module = `${c.module}/${c.name}`;
      // THE PLAY — a project card (a corporation / prelude plays through its own door; its bespoke play is still walked).
      if (c.play > 0 || c.bespoke) {
        resetDivertedNet();
        const t = table(c.name);
        const card = new c.Factory();
        const before = snapshot(t.game);
        const walk: Walk = {where: [], greeneryOrOceanCell: false};
        try {
          if (card.type === CardType.CORPORATION) {
            t.player.playCorporationCard(card as ICorporationCard);
          } else {
            t.player.playCard(card as IProjectCard);
          }
          walkPrompts(t, walk);
        } catch (e) {
          walk.unwalkable = `the play threw: ${(e as Error).message}`;
        }
        walked++;
        const verdict = judge(t, walk, `${module} [play]`, c.play, before);
        if (verdict.failure !== undefined) {
          leaking.set(`${c.name}:play`, verdict.failure);
        } else if (verdict.info !== undefined) {
          infos.push(verdict.info);
        }
      }
      // THE ACTION — every top-level branch on its own fresh table.
      if (c.action > 0 || c.bespoke) {
        const probe = new c.Factory();
        if (!isIActionCard(probe)) {
          continue;
        }
        for (let branch = 0; branch < 4; branch++) {
          resetDivertedNet();
          const t = table(c.name);
          const card = new c.Factory();
          t.player.playedCards.push(card);
          if (card.resourceType !== undefined) {
            card.resourceCount = 4;
          }
          if (!isIActionCard(card) || !card.canAct(t.player)) {
            break;
          }
          const before = snapshot(t.game);
          const walk: Walk = {where: [], greeneryOrOceanCell: false};
          let branches = 1;
          try {
            // The action's own prompt, raised the way the server raises it (a declarative card DEFERS its OrOptions).
            const own = card.action(t.player);
            if (own !== undefined) {
              t.player.defer(own);
            }
            runAllActions(t.game);
            const live = t.player.getWaitingFor();
            if (live instanceof OrOptions) {
              branches = live.options.length;
              if (branch >= branches) {
                break;
              }
              const inner = answerOf(live.options[branch], walk);
              if (inner === undefined) {
                walk.unwalkable = `branch ${branch} the guard cannot answer`;
              } else {
                t.player.process({type: 'or', index: branch, response: inner});
              }
            } else if (live !== undefined) {
              const response = answerOf(live, walk);
              if (response === undefined) {
                walk.unwalkable = `a ${live.type} prompt the guard cannot answer`;
              } else {
                t.player.process(response);
              }
            }
            if (walk.unwalkable === undefined) {
              walkPrompts(t, walk);
            }
          } catch (e) {
            walk.unwalkable = `the action threw: ${(e as Error).message}`;
          }
          walked++;
          // A declared action's printed units; a branch of an `or` is judged by the contract alone (its units are the branch's).
          const printed = probe.actionBehavior?.or === undefined ? c.action : 0;
          const verdict = judge(t, walk, `${module} [action · branch ${branch}]`, printed, before);
          if (verdict.failure !== undefined) {
            leaking.set(`${c.name}:action:${branch}`, verdict.failure);
          } else if (verdict.info !== undefined) {
            infos.push(verdict.info);
          }
          if (branch + 1 >= branches) {
            break;
          }
        }
      }
    }
    resetDivertedNet();
    expect(walked, 'the sweep walked something (anti-vacuity)').greaterThan(40);
    const regressions = [...leaking.entries()].filter(([key]) => !LEFTOVER_DIVERT_WORKLIST.has(key));
    expect(regressions.map(([, where]) => where),
      `\nCards breaking the replacing law (the engine entries / the exit pass are the fix, never the card):\n${regressions.map(([, where]) => where).join('\n')}\n\nINFO (not walked to the end):\n${infos.join('\n')}\n`).is.empty;
    const stale = [...LEFTOVER_DIVERT_WORKLIST].filter((key) => !leaking.has(key));
    expect(stale, `\nFIXED — remove from LEFTOVER_DIVERT_WORKLIST:\n${stale.join('\n')}\n`).is.empty;
  }).timeout(240_000);
});
