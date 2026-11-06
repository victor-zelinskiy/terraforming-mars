import {expect} from 'chai';
import {AUTOMA_SUPPORTED_BOARDS} from '../../../src/common/automa/automaCompatibility';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {CardName} from '../../../src/common/cards/CardName';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {awardManifest} from '../../../src/server/awards/Awards';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {IMilestone} from '../../../src/server/milestones/IMilestone';
import {IAward} from '../../../src/server/awards/IAward';
import {marsBotOf} from '../../../src/server/automa/AutomaUtil';
import {botAwardRawScore, botMilestoneProgress} from '../../../src/server/automa/ma/botMAInterpreter';
import {tryAwardHelper} from '../../../src/server/automa/AutomaBonusCards';
import {testAutomaGame} from '../AutomaTestGame';
import {legacyAwardRawScore, legacyMilestoneProgress} from './legacyBotMAOracle';
import {legacyTryAwardHelper} from './legacyBotMAHelperOracle';
import {addOcean} from '../../TestingUtils';

/**
 * THE MIGRATION GATE of the bot-rule registry (docs/claude/prompts/marsbot-dynamic-ma-framework.md, stage 1): on
 * EVERY supported board, with and without Venus Next + Colonies, over seeded random bot states, the registry's
 * evaluation ≡ the frozen legacy `switch` (`legacyBotMAOracle.ts`) for EVERY manifest name, and the registry's
 * Corporate Competition helpers ≡ the frozen legacy helper switch (`legacyBotMAHelperOracle.ts`) — the same answer
 * and the same resulting game state, on two clones of one game.
 *
 * A rule the registry deliberately re-points later (a tag-referenced criterion on a mat whose pairing moves) is
 * listed in `REPOINTED` with the boards where it must still agree — its home boards — and the reason
 * (docs/claude/marsbot-dynamic-ma-progress.md § deviations).
 */

/** Names the registry deliberately re-pointed after the migration → the boards where it must still agree. */
const REPOINTED: ReadonlyMap<string, ReadonlyArray<string>> = new Map();

function lcg(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const PILE_SAMPLES: ReadonlyArray<CardName> = [
  CardName.ALGAE, CardName.BIG_ASTEROID, CardName.AQUIFER_PUMPING, CardName.LOBBYING_CAMPAIGN, CardName.GANYMEDE_COLONY,
  CardName.SPACE_ELEVATOR, CardName.ASTEROID, CardName.VIRAL_ENHANCERS, CardName.SEARCH_FOR_LIFE, CardName.NUCLEAR_ZONE,
  CardName.HACKERS, CardName.SABOTAGE, CardName.MINING_RIGHTS, CardName.TECTONIC_STRESS_POWER, CardName.EARTH_OFFICE,
];

/** Moves every quantity a bot criterion can read, at random but reproducibly. */
function randomizeBot(game: IGame, rnd: () => number): void {
  const automa = game.automa!;
  for (const track of automa.board.tracks) {
    track.position = Math.floor(rnd() * (track.maxPosition + 1));
  }
  const bot = marsBotOf(game);
  bot.megaCredits = Math.floor(rnd() * 70);
  automa.floaters = Math.floor(rnd() * 10);
  bot.setTerraformRating(20 + Math.floor(rnd() * 25));
  automa.playedPile = [];
  const pileSize = Math.floor(rnd() * 12);
  for (let i = 0; i < pileSize; i++) {
    automa.playedPile.push(PILE_SAMPLES[Math.floor(rnd() * PILE_SAMPLES.length)]);
  }
  automa.destroyedBonusCards = new Array<BonusCardId>(Math.floor(rnd() * 5)).fill(BonusCardId.B04_OVERACHIEVEMENT);
  automa.actionDeck = automa.actionDeck.slice(0, Math.floor(rnd() * 5));
}

function configs(): Array<[string, object]> {
  return AUTOMA_SUPPORTED_BOARDS.flatMap((boardName) => [
    [`${boardName}`, {boardName}],
    [`${boardName}+venus+colonies`, {boardName, venusNextExtension: true, coloniesExtension: true}],
  ] as Array<[string, object]>);
}

function outcome<T>(f: () => T): T | string {
  try {
    return f();
  } catch (e) {
    return `throws ${(e as Error).message}`;
  }
}

/** Wall-clock fields — two clones run a few ms apart, so these are the only honest differences. */
const WALL_CLOCK_KEYS: ReadonlySet<string> = new Set(['timer', 'timestamp']);

/** The serialized game minus the wall clock. */
function comparable(game: IGame): string {
  return JSON.stringify(game.serialize(), (key, value) => (WALL_CLOCK_KEYS.has(key) ? undefined : value));
}

/** The first serialized path where two games differ — what a red helper check prints. */
function firstDifference(a: unknown, b: unknown, path = ''): string | undefined {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    return undefined;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
      const found = firstDifference(ra[key], rb[key], `${path}.${key}`);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 160)} vs ${JSON.stringify(b)?.slice(0, 160)}`;
}

function mustAgree(name: string, boardName: string): boolean {
  const homes = REPOINTED.get(name);
  return homes === undefined || homes.includes(boardName);
}

describe('bot-rule registry — differential against the legacy switch', () => {
  it('every milestone and award evaluates exactly as the legacy switch, on every board, over random states', () => {
    const milestones: Array<IMilestone> = Object.keys(milestoneManifest.all).map((n) => milestoneManifest.createOrThrow(n));
    const awards: Array<IAward> = Object.keys(awardManifest.all).map((n) => awardManifest.createOrThrow(n));
    const mismatches: Array<string> = [];
    let checks = 0;
    for (const [label, options] of configs()) {
      const [game] = testAutomaGame(options, `-diff-${label}`);
      const boardName = String(game.gameOptions.boardName);
      const rnd = lcg(label.length * 7919 + 13);
      for (let s = 0; s < 40; s++) {
        randomizeBot(game, rnd);
        for (const m of milestones) {
          if (!mustAgree(m.name, boardName)) {
            continue;
          }
          checks++;
          const legacy = JSON.stringify(outcome(() => legacyMilestoneProgress(m, game)));
          const now = JSON.stringify(outcome(() => botMilestoneProgress(m, game)));
          if (legacy !== now) {
            mismatches.push(`${label} @${s} milestone ${m.name}: legacy ${legacy} ≠ registry ${now}`);
          }
        }
        for (const a of awards) {
          if (!mustAgree(a.name, boardName)) {
            continue;
          }
          checks++;
          const legacy = JSON.stringify(outcome(() => legacyAwardRawScore(a, game)));
          const now = JSON.stringify(outcome(() => botAwardRawScore(a, game)));
          if (legacy !== now) {
            mismatches.push(`${label} @${s} award ${a.name}: legacy ${legacy} ≠ registry ${now}`);
          }
        }
      }
    }
    expect(mismatches.slice(0, 30), mismatches.slice(0, 30).join('\n')).is.empty;
    expect(checks).is.greaterThan(50_000);
  }).timeout(300_000);

  it('every Corporate Competition helper acts exactly as the legacy switch — the answer and the resulting state', () => {
    const mismatches: Array<string> = [];
    let acted = 0;
    // Two clones per award per state — the costly part. The CI sweep takes the base configuration of every board and
    // two states (one random, one with every track at its end); `TM_BOT_MA_FULL_DIFF=1` runs the migration gate's full
    // sweep (both configurations, four states — green at the migration, docs/claude/marsbot-dynamic-ma-progress.md).
    const full = process.env.TM_BOT_MA_FULL_DIFF === '1';
    const states = full ? 4 : 2;
    for (const [label, options] of configs().filter(([l]) => full || !l.includes('+venus'))) {
      const [game] = testAutomaGame(options, `-diffh-${label}`);
      const boardName = String(game.gameOptions.boardName);
      const rnd = lcg(label.length * 104729 + 7);
      // Give the board some shape — oceans for the ocean-adjacent helpers.
      for (let i = 0; i < 3; i++) {
        addOcean(marsBotOf(game));
      }
      for (let s = 0; s < states; s++) {
        randomizeBot(game, rnd);
        // A track at its end is part of the helper contract (impossible to resolve) — the last state maxes them all.
        if (s === states - 1) {
          for (const track of game.automa!.board.tracks) {
            track.position = track.maxPosition;
          }
        }
        const snapshot = game.serialize();
        for (const name of Object.keys(awardManifest.all)) {
          if (!mustAgree(name, boardName)) {
            continue;
          }
          const a = Game.deserialize(structuredClone(snapshot));
          const b = Game.deserialize(structuredClone(snapshot));
          const legacy = outcome(() => legacyTryAwardHelper(a, name));
          const now = outcome(() => tryAwardHelper(b, name));
          if (legacy === true) {
            acted++;
          }
          if (legacy !== now) {
            mismatches.push(`${label} @${s} helper ${name}: legacy ${legacy} ≠ registry ${now}`);
            continue;
          }
          const sa = comparable(a);
          const sb = comparable(b);
          if (sa !== sb) {
            mismatches.push(`${label} @${s} helper ${name}: the resulting game states differ at ` +
              firstDifference(JSON.parse(sa), JSON.parse(sb)));
          }
        }
      }
    }
    expect(mismatches.slice(0, 30), mismatches.slice(0, 30).join('\n')).is.empty;
    expect(acted, 'the sweep must actually exercise the helpers').is.greaterThan(full ? 300 : 80);
  }).timeout(300_000);
});
