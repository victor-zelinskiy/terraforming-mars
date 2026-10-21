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
import {ActionPreview} from '../../src/common/models/ActionPreviewModel';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {UNMI_VETO_ID} from '../../src/server/parliament/resolutions/reds/UnmiVeto';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';

/*
 * THE RATING VETO, SWEPT OVER THE WHOLE SCOPE (Turmoil Redux RX42 UNMI Veto — invariant 11: a guard is the
 * worklist) — THE OWNER'S OWN REQUIREMENT, PROVED: a seat first by rating must never be promised a rating the law
 * will refuse, and never refused a rating it was not warned about.
 *
 * Under the enacted law, with the acting seat FIRST by rating (60 against 20), every in-scope card whose PLAY or
 * ACTION raises a rating — declared (`behavior` / `actionBehavior`: a `tr`, a step of oxygen / temperature / Venus,
 * an ocean, a greenery) or bespoke (the card's source reaches for the funnel or a scale / tile door) — is walked for
 * real, its prompts answered the cheapest valid way, and the law's contract is asserted on each:
 *  · the seat's rating never ROSE (a lowering is allowed — Backroom Deal's, TR47's fall);
 *  · every refusal is NAMED with its magnitude (an `effect-skipped` under the law's own marker);
 *  · PROMISED ↔ PERFORMED, number for number: the sum of the rating steps the preview's exit pass STRUCK on the
 *    branch walked equals the sum the funnel refused live — for a one-branch preview exactly; a preview whose
 *    branch the walk took cannot be told (a bespoke «dynamic» preview, an `or` of several) is judged by the contract
 *    alone and listed as INFO;
 *  · and where the card prints a scale step or a tile, THE WORLD MOVED: a scale rose or a tile landed (the veto takes
 *    the rating alone — never the planet).
 * A card the walk cannot drive (a prompt the guard cannot synthesize, a play that throws for want of a table state —
 * a hazard to protect, a colony to build on) is reported as INFO, never as a failure.
 *
 * `LEFTOVER_VETO_WORKLIST` is EMPTY ON PURPOSE and fails BOTH ways: a new leak is a regression, a fixed entry must
 * be removed.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);
const LEFTOVER_VETO_WORKLIST = new Set<string>([]);

const VETO = resolutionInstanceId(UNMI_VETO_ID, 0);

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

/** A bespoke road to a rating: the funnel itself, or a scale / tile door whose rating rides the funnel. */
const BESPOKE_DOOR = /increaseTerraformRating\(|PlaceGreeneryTile|PlaceOceanTile|increaseOxygenLevel|increaseTemperature|increaseVenusScaleLevel|addGreenery\(|addOcean\(/;

/** The PRINTED rating roads a behavior declares — what the law may refuse (every step of a scale is a rating for the raiser). */
function printedRatings(behavior: Behavior | undefined): number {
  if (behavior === undefined) {
    return 0;
  }
  let units = 0;
  units += typeof behavior.tr === 'number' && behavior.tr > 0 ? behavior.tr : 0;
  units += Math.max(0, behavior.global?.oxygen ?? 0);
  units += Math.max(0, behavior.global?.temperature ?? 0);
  units += Math.max(0, behavior.global?.venus ?? 0);
  units += behavior.ocean !== undefined ? (behavior.ocean.count ?? 1) : 0;
  units += behavior.greenery !== undefined ? 1 : 0;
  return units;
}

/** The tiles a behavior prints (an ocean count, a greenery) — what the walk must have seated for its refusals to be whole. */
function printedTiles(behavior: Behavior | undefined): number {
  if (behavior === undefined) {
    return 0;
  }
  return (behavior.ocean !== undefined ? (behavior.ocean.count ?? 1) : 0) + (behavior.greenery !== undefined ? 1 : 0);
}

/** Does the behavior move THE WORLD (a scale, a tile) — what must still happen under the veto? */
function movesWorld(behavior: Behavior | undefined): boolean {
  if (behavior === undefined) {
    return false;
  }
  return (behavior.global?.oxygen ?? 0) > 0 || (behavior.global?.temperature ?? 0) > 0 || (behavior.global?.venus ?? 0) > 0 ||
    behavior.ocean !== undefined || behavior.greenery !== undefined;
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
        const play = printedRatings(probe.behavior);
        const action = printedRatings(probe.actionBehavior);
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

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer};

function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  game.parliament!.enacted = VETO;
  player.terraformRating = 60;
  opponent.terraformRating = 20;
  player.megaCredits = 200;
  player.steel = 20;
  player.titanium = 20;
  player.plants = 20;
  player.energy = 20;
  player.heat = 40;
  opponent.megaCredits = 20;
  opponent.plants = 10;
  return {game, player, opponent};
}

type Walk = {unwalkable?: string};

/** The cheapest valid answer of a live input — undefined when the guard cannot synthesize one. */
function answerOf(input: PlayerInput, walk: Walk): InputResponse | undefined {
  if (input instanceof SelectSpace) {
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

/** What the LAW refused live for the seat — the magnitudes of its named skips, summed. */
function refusedLive(t: Table): number {
  const marks = new Set(t.game.events.events
    .filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution' && e.source.id === UNMI_VETO_ID && e.trigger === 'rating-vetoed')
    .map((e) => e.id));
  return t.game.events.events
    .filter((e) => e.type === 'effect-skipped' && e.player === t.player.color && e.parentId !== undefined && marks.has(e.parentId))
    .reduce((sum, e) => sum + (e.impact.skipped?.effect?.amount ?? 0), 0);
}

/** What the PREVIEW promised the law would refuse on `branch` — undefined when the walked branch cannot be told. */
function promised(preview: ActionPreview, branch: number | undefined): number | undefined {
  if (preview.kind === 'dynamic') {
    return undefined;
  }
  if (preview.branches.length === 1) {
    return preview.branches[0].effects.reduce((sum, e) => sum + (e.vetoed?.steps ?? 0), 0);
  }
  if (branch === undefined || preview.branches[branch] === undefined) {
    return undefined;
  }
  return preview.branches[branch].effects.reduce((sum, e) => sum + (e.vetoed?.steps ?? 0), 0);
}

type Verdict = {failure?: string, info?: string};

type Snapshot = {oxygen: number, temperature: number, venus: number, oceans: number, greeneries: number, tr: number};

function snapshot(t: Table): Snapshot {
  const game = t.game;
  return {
    oxygen: game.getOxygenLevel(), temperature: game.getTemperature(), venus: game.getVenusScaleLevel(),
    oceans: game.board.getOceanSpaces().length,
    greeneries: game.board.spaces.filter((s) => s.player === t.player && s.tile?.tileType !== undefined).length,
    tr: t.player.terraformRating,
  };
}

function judge(t: Table, walk: Walk, label: string, before: Snapshot, world: boolean, expected: number | undefined, tiles = 0): Verdict {
  const problems: Array<string> = [];
  const after = snapshot(t);
  // The harness answers a second placement prompt over the first (the engine's «Overwriting waitingFor»): a tile the
  // card prints and the walk never seated was never refused either — the walk did not reach the end.
  if (walk.unwalkable === undefined && tiles > 0 && (after.oceans - before.oceans) + (after.greeneries - before.greeneries) < tiles) {
    walk.unwalkable = `the walk seated ${(after.oceans - before.oceans) + (after.greeneries - before.greeneries)} of ${tiles} printed tile(s) (a placement prompt the harness overwrote)`;
  }
  if (after.tr > before.tr) {
    problems.push(`the rating ROSE ${before.tr} → ${after.tr} for the seat first by rating`);
  }
  const live = refusedLive(t);
  if (expected !== undefined && walk.unwalkable === undefined && live !== expected) {
    problems.push(`the preview struck ${expected} rating step(s), the law refused ${live} live`);
  }
  if (world && walk.unwalkable === undefined) {
    const moved = after.oxygen > before.oxygen || after.temperature > before.temperature || after.venus > before.venus ||
      after.oceans > before.oceans || after.greeneries > before.greeneries;
    const maxed = after.oxygen === before.oxygen && after.temperature === before.temperature && after.venus === before.venus;
    if (!moved && !maxed) {
      problems.push('the world did not move — the veto took more than the rating');
    }
  }
  if (problems.length > 0) {
    return {failure: `${label} :: ${problems.join('; ')}`};
  }
  if (walk.unwalkable !== undefined) {
    return {info: `${label} :: ${walk.unwalkable}`};
  }
  if (expected === undefined) {
    return {info: `${label} :: the walked branch cannot be matched to a preview branch (refused ${live} live)`};
  }
  return {};
}

describe('UnmiVeto — the sweep over the scope (the worklist): promised ↔ performed, number for number', () => {
  it('every in-scope card that raises a rating on its PLAY or on its ACTION obeys the veto, is warned exactly as it is refused, and still moves the world', () => {
    const leaking = new Map<string, string>();
    const infos: Array<string> = [];
    let walked = 0;
    let matched = 0;
    for (const c of candidates()) {
      const module = `${c.module}/${c.name}`;
      // THE PLAY — a project card (a corporation / prelude plays through its own door; its bespoke play is still walked).
      if (c.play > 0 || c.bespoke) {
        const t = table();
        const card = new c.Factory();
        const before = snapshot(t);
        const walk: Walk = {};
        let expected: number | undefined;
        try {
          if (card.type === CardType.CORPORATION) {
            t.player.playCorporationCard(card as ICorporationCard);
          } else {
            expected = promised(cardPlayPreview(t.player, card), 0);
            t.player.playCard(card as IProjectCard);
          }
          walkPrompts(t, walk);
        } catch (e) {
          walk.unwalkable = `the play threw: ${(e as Error).message}`;
        }
        walked++;
        const verdict = judge(t, walk, `${module} [play]`, before, movesWorld(card.behavior), expected, printedTiles(card.behavior));
        if (verdict.failure !== undefined) {
          leaking.set(`${c.name}:play`, verdict.failure);
        } else if (verdict.info !== undefined) {
          infos.push(verdict.info);
        } else {
          matched++;
        }
      }
      // THE ACTION — every top-level branch on its own fresh table.
      if (c.action > 0 || c.bespoke) {
        const probe = new c.Factory();
        if (!isIActionCard(probe)) {
          continue;
        }
        for (let branch = 0; branch < 4; branch++) {
          const t = table();
          const card = new c.Factory();
          t.player.playedCards.push(card);
          if (card.resourceType !== undefined) {
            card.resourceCount = 4;
          }
          t.player.hasIncreasedTerraformRatingThisGeneration = true; // the UNMI corporation's gate
          if (!isIActionCard(card) || !card.canAct(t.player)) {
            break;
          }
          const before = snapshot(t);
          const walk: Walk = {};
          let branches = 1;
          let expected: number | undefined;
          try {
            const preview = actionPreview(t.player, card);
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
              expected = promised(preview, branch);
              const inner = answerOf(live.options[branch], walk);
              if (inner === undefined) {
                walk.unwalkable = `branch ${branch} the guard cannot answer`;
              } else {
                t.player.process({type: 'or', index: branch, response: inner});
              }
            } else {
              expected = promised(preview, 0);
              if (live !== undefined) {
                const response = answerOf(live, walk);
                if (response === undefined) {
                  walk.unwalkable = `a ${live.type} prompt the guard cannot answer`;
                } else {
                  t.player.process(response);
                }
              }
            }
            if (walk.unwalkable === undefined) {
              walkPrompts(t, walk);
            }
          } catch (e) {
            walk.unwalkable = `the action threw: ${(e as Error).message}`;
          }
          walked++;
          const world = probe.actionBehavior?.or === undefined && movesWorld(probe.actionBehavior);
          const verdict = judge(t, walk, `${module} [action · branch ${branch}]`, before, world, expected);
          if (verdict.failure !== undefined) {
            leaking.set(`${c.name}:action:${branch}`, verdict.failure);
          } else if (verdict.info !== undefined) {
            infos.push(verdict.info);
          } else {
            matched++;
          }
          if (branch + 1 >= branches) {
            break;
          }
        }
      }
    }
    expect(walked, 'the sweep walked something (anti-vacuity)').greaterThan(60);
    expect(matched, 'the sweep matched promises to refusals (anti-vacuity)').greaterThan(40);
    const regressions = [...leaking.entries()].filter(([key]) => !LEFTOVER_VETO_WORKLIST.has(key));
    expect(regressions.map(([, where]) => where),
      `\nCards breaking the rating veto (the funnel's gate / the exit pass are the fix, never the card):\n${regressions.map(([, where]) => where).join('\n')}\n\nINFO (not walked to the end, or a branch the preview cannot name):\n${infos.join('\n')}\n`).is.empty;
    const stale = [...LEFTOVER_VETO_WORKLIST].filter((key) => !leaking.has(key));
    expect(stale, `\nFIXED — remove from LEFTOVER_VETO_WORKLIST:\n${stale.join('\n')}\n`).is.empty;
  }).timeout(240_000);

  it('THE ONE FUNNEL: no rating of the game is granted outside `Player.increaseTerraformRating` (no `terraformRating +=` / `++` beyond the funnel and the cloner)', () => {
    const root = path.join(__dirname, '../../src/server');
    const offenders: Array<string> = [];
    const walk = (d: string): void => {
      for (const entry of fs.readdirSync(d, {withFileTypes: true})) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const rel = path.relative(root, full).replaceAll('\\', '/');
          if (rel === 'Player.ts' || rel === 'database/Cloner.ts') {
            continue;
          }
          const text = fs.readFileSync(full, 'utf8');
          if (/(?<!points)\.terraformRating\s*(\+=|\+\+|-=|--)/.test(text)) {
            offenders.push(rel);
          }
        }
      }
    };
    walk(root);
    expect(offenders, 'every rating goes through the funnel — the veto\'s one gate').deep.eq([]);
  });

  it('EVERY DOOR of the replacing pass (RX35) runs the veto pass too (RX42) — a door with one and not the other lies on one of two laws', () => {
    const root = path.join(__dirname, '../../src/server');
    const DIVERT = /\b(divertEffects|withDivertedTerraforming|divertedUnitChip)\(/;
    const VETO_PASS = /\b(vetoEffects|withVetoedRating)\(/;
    const missing: Array<string> = [];
    const walk = (d: string): void => {
      for (const entry of fs.readdirSync(d, {withFileTypes: true})) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const rel = path.relative(root, full).replaceAll('\\', '/');
          if (rel === 'models/divertedTerraforming.ts' || rel === 'models/vetoedRating.ts') {
            continue;
          }
          const text = fs.readFileSync(full, 'utf8');
          const diverts = DIVERT.test(text);
          const vetoes = VETO_PASS.test(text);
          if (diverts !== vetoes) {
            missing.push(`${rel}: ${diverts ? 'runs the diverting pass without the veto pass' : 'runs the veto pass without the diverting pass'}`);
          }
        }
      }
    };
    walk(root);
    expect(missing, 'the two replacing passes stand in the same doors').deep.eq([]);
  });
});
