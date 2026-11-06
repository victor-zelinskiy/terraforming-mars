import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {AUTOMA_SUPPORTED_BOARDS} from '../../../src/common/automa/automaCompatibility';
import {buildBonusCardView} from '../../../src/common/automa/BonusCardData';
import {RandomMAOptionType} from '../../../src/common/ma/RandomMAOptionType';
import {MilestoneName} from '../../../src/common/ma/MilestoneName';
import {AwardName} from '../../../src/common/ma/AwardName';
import {GameOptions} from '../../../src/server/game/GameOptions';
import {getCandidates} from '../../../src/server/ma/MilestoneAwardSelector';
import {randomExclusionGroup} from '../../../src/server/ma/MilestoneAwardExclusions';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {milestoneThreshold} from '../../../src/server/milestones/IMilestone';
import {generateBotMat, MAT_TOPOLOGIES, criterionRoles} from '../../../src/server/automa/ma/matGenerator';
import {matViolations} from '../../../src/server/automa/ma/matLaw';
import {awardReachable, MatConfig, milestoneReachable} from '../../../src/server/automa/ma/matReachability';
import {botMilestoneRule} from '../../../src/server/automa/ma/botMAInterpreter';
import {describeAwardHelper} from '../../../src/server/automa/ma/botMADescribe';
import {profileForMat} from '../../../src/server/automa/ma/matProfile';
import {VENUS_TRACK} from '../../../src/server/automa/boards/VenusMarsBot';
import {AutomaSetup} from '../../../src/server/automa/AutomaSetup';
import {DeckTagMix} from '../../../src/server/automa/ma/matPressure';
import {testAutomaGame} from '../AutomaTestGame';

/**
 * THE STATIC VALIDATOR of the random-set framework (the prompt's § Баланс 2 — a unit, in CI, seconds): seeded random
 * sets drawn from the real candidate pools (the unified «all» pool and the modular one, with the exclusion groups),
 * on every supported map, across the expansion configurations — every generated mat is lawful, deterministic, every
 * milestone reachable, every award able to score (but the one honest zero), no jump into a threshold, no pair of
 * milestones on one track that some topology could have kept apart, and a B14 line for every award.
 *
 * 2000 sets × 10 maps (the configuration rotates per set — each one meets ~333 sets on every map); the full cross
 * product (2000 × 10 × 6) runs with `TM_BOT_MA_FULL_VALIDATOR=1` — green at stage 3 (docs/claude/marsbot-dynamic-ma-progress.md).
 */

const SETS = 2000;

type Config = {label: string, options: Partial<GameOptions>};

const CONFIGS: ReadonlyArray<Config> = [
  {label: 'base', options: {}},
  {label: 'venus', options: {venusNextExtension: true}},
  {label: 'colonies', options: {coloniesExtension: true}},
  {label: 'redux', options: {turmoilReduxExpansion: true, coloniesExtension: true}},
  {label: 'ares', options: {aresExtension: true}},
  {label: 'all', options: {venusNextExtension: true, coloniesExtension: true, turmoilReduxExpansion: true, aresExtension: true}},
];

function lcg(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T extends string>(candidates: ReadonlyArray<T>, n: number, rnd: () => number, used: Set<string>): Array<T> {
  const pool = [...candidates];
  const out: Array<T> = [];
  while (out.length < n && pool.length > 0) {
    const [name] = pool.splice(Math.floor(rnd() * pool.length), 1);
    const group = randomExclusionGroup(name as MilestoneName | AwardName);
    if (group !== undefined && used.has(group)) {
      continue;
    }
    if (group !== undefined) {
      used.add(group);
    }
    out.push(name);
  }
  return out;
}

type Prepared = {config: Config, options: GameOptions, deck: ReadonlyArray<CardName>, mix: DeckTagMix, thresholds: Map<string, number | undefined>};

function prepare(config: Config): Prepared {
  const [game] = testAutomaGame(config.options, `-validator-${config.label}`);
  const deck = [...game.projectDeck.drawPile, ...game.projectDeck.discardPile].map((c) => c.name);
  const thresholds = new Map<string, number | undefined>();
  for (const name of Object.keys(milestoneManifest.all)) {
    thresholds.set(name, milestoneThreshold(milestoneManifest.createOrThrow(name), game));
  }
  return {config, options: game.gameOptions, deck, mix: AutomaSetup.deckTagMix(game), thresholds};
}

describe('MarsBot mat generator — the static validator', () => {
  it(`${SETS} seeded random sets × every supported map: lawful, deterministic, reachable, no jump, honest shares, a B14 line per award`, () => {
    const full = process.env.TM_BOT_MA_FULL_VALIDATOR === '1';
    const prepared = CONFIGS.map(prepare);
    const failures: Array<string> = [];
    let mats = 0;
    const rnd = lcg(20261106);
    for (let s = 0; s < SETS; s++) {
      const configs = full ? prepared : [prepared[s % prepared.length]];
      for (const p of configs) {
        const modular = s % 2 === 1;
        const venus = p.options.venusNextExtension;
        const qty = venus ? 6 : 5;
        const poolOptions: GameOptions = {...p.options, randomMA: modular ? RandomMAOptionType.UNLIMITED : RandomMAOptionType.ALL, modularMA: modular};
        const [milestonePool, awardPool] = getCandidates(poolOptions);
        const used = new Set<string>();
        const milestones = pick(milestonePool, qty, rnd, used);
        const awards = pick(awardPool, qty, rnd, used);
        for (const boardName of AUTOMA_SUPPORTED_BOARDS) {
          const label = `#${s} ${p.config.label}${modular ? '/modular' : ''} ${boardName} [${milestones.join(', ')} | ${awards.join(', ')}]`;
          let mat;
          try {
            mat = generateBotMat({boardName, milestones, awards, venus, colonies: p.options.coloniesExtension, deckTags: p.mix});
          } catch (e) {
            failures.push(`${label}: ${(e as Error).message}`);
            continue;
          }
          mats++;
          if (matViolations(mat.tracks).length > 0) {
            failures.push(`${label}: unlawful`);
          }
          if (s % 50 === 0 && JSON.stringify(mat) !== JSON.stringify(generateBotMat({boardName, milestones, awards, venus, colonies: p.options.coloniesExtension, deckTags: p.mix}))) {
            failures.push(`${label}: not deterministic`);
          }
          // The game's tracks: the mat's seven + the Venus row with Venus Next (the one a generated mat picks).
          const tracks = venus ? [...mat.tracks, profileForMat(boardName, mat).venusTrack ?? VENUS_TRACK] : mat.tracks;
          const config: MatConfig = {tracks, venus, colonies: p.options.coloniesExtension, parliament: p.options.turmoilReduxExpansion, deck: p.deck};
          for (const name of milestones) {
            const r = milestoneReachable(name, config, p.thresholds.get(name));
            if (!r.ok) {
              failures.push(`${label}: milestone ${name} unreachable — ${r.reason}`);
            }
          }
          for (const name of awards) {
            const r = awardReachable(name, config);
            if (!r.ok && name !== 'Entrepreneur') {
              failures.push(`${label}: award ${name} cannot score — ${r.reason}`);
            }
          }
          for (const c of mat.report.criteria) {
            if (c.threshold !== undefined) {
              const track = mat.tracks.find((t) => t.role === c.threshold!.role)!;
              if (track.layout[c.threshold.cell - 1] === 'advance') {
                failures.push(`${label}: a jump into ${c.name} at ${c.threshold.role} ${c.threshold.cell}`);
              }
            }
          }
          // Pairs of milestones on one track: as few as ANY topology allows (the law of pairs, checklist §A).
          const mmPairs = (t: typeof MAT_TOPOLOGIES[number]) => {
            let pairs = 0;
            for (let i = 0; i < milestones.length; i++) {
              for (let j = i + 1; j < milestones.length; j++) {
                const a = criterionRoles(botMilestoneRule(milestones[i])!.criterion, t);
                const b = criterionRoles(botMilestoneRule(milestones[j])!.criterion, t);
                if (a.some((role) => b.includes(role))) {
                  pairs++;
                }
              }
            }
            return pairs;
          };
          const chosen = MAT_TOPOLOGIES.find((t) => t.id === mat.topology)!;
          const fewest = Math.min(...MAT_TOPOLOGIES.map(mmPairs));
          if (mmPairs(chosen) > fewest) {
            failures.push(`${label}: ${mmPairs(chosen)} milestone pairs share a track on ${mat.topology}, ${fewest} possible`);
          }
          const view = buildBonusCardView(BonusCardId.B14_CORPORATE_COMPETITION_MA, {venus, colonies: p.options.coloniesExtension,
            competition: awards.map((award) => ({award, helper: describeAwardHelper(award)}))});
          if (view.lines.filter((l) => l.award !== undefined).length !== awards.length) {
            failures.push(`${label}: the B14 face misses an award`);
          }
        }
      }
    }
    // One line per KIND of failure first (the label varies per set), then the first instances.
    const kinds = [...new Set(failures.map((f) => f.replace(/^.*?\]: /, '').replace(/ — .*/, '')))];
    expect(failures.slice(0, 25), `${failures.length} failures, kinds: ${kinds.join(' · ')}\n${failures.slice(0, 25).join('\n')}`).is.empty;
    expect(mats).is.greaterThanOrEqual(SETS * AUTOMA_SUPPORTED_BOARDS.length);
  }).timeout(600_000);
});
