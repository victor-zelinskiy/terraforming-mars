/*
 * THE RATING-REFUSAL WALK — the machinery both sweeps of a refused rating share (RX42 UNMI Veto: the law refuses a
 * whole event; P57 Preservation Program: a card skips the first step of the generation's action phase). The scope's
 * candidates (every in-scope card whose PLAY or ACTION raises a rating, declared or bespoke), the cheapest valid
 * answer of a live input, the prompt walk. Each sweep owns its table and its judge.
 */
import * as fs from 'fs';
import * as path from 'path';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
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
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';

export const SCOPE = PREMIUM_SCOPE_MODULES;

/** The module key → source directory (two differ: `ceo` ↔ `ceos`, `deltaProject` ↔ `delta`). */
export function dirOf(module: GameModule): string {
  if (module === 'ceo') {
    return 'ceos';
  }
  if (module === 'deltaProject') {
    return 'delta';
  }
  return module;
}

/** The source text of every card class in scope, by class name (read once). */
export const SOURCE_BY_CLASS = new Map<string, string>();
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
export const BESPOKE_DOOR = /increaseTerraformRating\(|PlaceGreeneryTile|PlaceOceanTile|increaseOxygenLevel|increaseTemperature|increaseVenusScaleLevel|addGreenery\(|addOcean\(/;

/** The PRINTED rating roads a behavior declares — what the law may refuse (every step of a scale is a rating for the raiser). */
export function printedRatings(behavior: Behavior | undefined): number {
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
export function printedTiles(behavior: Behavior | undefined): number {
  if (behavior === undefined) {
    return 0;
  }
  return (behavior.ocean !== undefined ? (behavior.ocean.count ?? 1) : 0) + (behavior.greenery !== undefined ? 1 : 0);
}

/** Does the behavior move THE WORLD (a scale, a tile) — what must still happen under the veto? */
export function movesWorld(behavior: Behavior | undefined): boolean {
  if (behavior === undefined) {
    return false;
  }
  return (behavior.global?.oxygen ?? 0) > 0 || (behavior.global?.temperature ?? 0) > 0 || (behavior.global?.venus ?? 0) > 0 ||
    behavior.ocean !== undefined || behavior.greenery !== undefined;
}

export type Candidate = {Factory: new () => ICard, module: GameModule, name: CardName, play: number, action: number, bespoke: boolean};

export function candidates(): Array<Candidate> {
  const out: Array<Candidate> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.includes(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined || !inPremiumScope({module: manifest.module, name}, SCOPE)) {
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

export type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer};

export type Walk = {unwalkable?: string};

/** The cheapest valid answer of a live input — undefined when the guard cannot synthesize one. */
export function answerOf(input: PlayerInput, walk: Walk): InputResponse | undefined {
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
export function walkPrompts(t: Table, walk: Walk): void {
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

