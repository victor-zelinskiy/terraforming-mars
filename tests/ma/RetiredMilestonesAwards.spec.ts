import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {awardManifest} from '../../src/server/awards/Awards';
import {retiredNames} from '../../src/server/ma/MAManifest';
import {chooseMilestonesAndAwards, getCandidates} from '../../src/server/ma/MilestoneAwardSelector';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../src/server/game/GameOptions';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {BoardName} from '../../src/common/boards/BoardName';
import {MilestoneName} from '../../src/common/ma/MilestoneName';
import {AwardName} from '../../src/common/ma/AwardName';
import {intersection} from '../../src/common/utils/utils';

/**
 * RETIRED MILESTONES / AWARDS (vize1215 fork, 2026-11-06) — `MAManifestSpec.retired`.
 *
 * Lobbyist and Politician count delegates SITTING in parties. The Turmoil Redux FAQ bars both («that milestone and
 * award no longer work as intended»), and the fork does not support the classic Turmoil — nothing is left to host them.
 * They stay in the manifests ONLY so an old save loads; no new game may ever reach them, by any road.
 *
 * This guard is the tripwire: a board set, an expansion set, a random mode or a card that starts naming a retired MA
 * fails here with the place, so a replacement gets DECIDED instead of a broken MA shipping.
 */
const RETIRED_MILESTONES: ReadonlyArray<MilestoneName> = ['Lobbyist'];
const RETIRED_AWARDS: ReadonlyArray<AwardName> = ['Politician'];
const RETIRED: ReadonlyArray<string> = [...RETIRED_MILESTONES, ...RETIRED_AWARDS];

const SRC = path.resolve(__dirname, '..', '..', 'src');
/** The only files that may spell a retired name: the name lists, the manifests, the classes kept for old saves. */
const ALLOWED = new Set([
  path.join('common', 'ma', 'MilestoneName.ts'),
  path.join('common', 'ma', 'AwardName.ts'),
  path.join('server', 'milestones', 'Milestones.ts'),
  path.join('server', 'awards', 'Awards.ts'),
  path.join('server', 'milestones', 'modular', 'Lobbyist.ts'),
  path.join('server', 'awards', 'modular', 'Politician.ts'),
]);

function sourceFiles(dir: string, out: Array<string>): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'genfiles' && entry.name !== 'locales') {
        sourceFiles(full, out);
      }
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function options(extra: Partial<GameOptions>, expansions: Partial<GameOptions['expansions']>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...extra, expansions: {...DEFAULT_GAME_OPTIONS.expansions, ...expansions}};
}

describe('Retired milestones / awards (Lobbyist, Politician)', function() {
  // A src/ tree walk, not a timing: the budget is that walk on a busy box.
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);

  it('the manifests retire exactly these, each deprecated, in no random pool, with its reason', () => {
    expect(retiredNames(milestoneManifest)).deep.eq(RETIRED_MILESTONES);
    expect(retiredNames(awardManifest)).deep.eq(RETIRED_AWARDS);
    const specs = [
      ...RETIRED_MILESTONES.map((name) => [name, milestoneManifest.all[name]] as const),
      ...RETIRED_AWARDS.map((name) => [name, awardManifest.all[name]] as const),
    ];
    for (const [name, spec] of specs) {
      expect(spec.deprecated, name).eq(true);
      expect(spec.random, `${name} names no random pool`).is.undefined;
      expect(spec.retired, name).is.a('string').and.not.empty;
    }
  });

  it('no board set and no expansion set names a retired MA', () => {
    const sets: Array<[string, ReadonlyArray<string>]> = [
      ...Object.entries(milestoneManifest.boards).map(([board, names]): [string, ReadonlyArray<string>] => [`milestones of ${board}`, names]),
      ...Object.entries(awardManifest.boards).map(([board, names]): [string, ReadonlyArray<string>] => [`awards of ${board}`, names]),
      ...Object.entries(milestoneManifest.expansions).map(([e, names]): [string, ReadonlyArray<string>] => [`milestones of ${e}`, names]),
      ...Object.entries(awardManifest.expansions).map(([e, names]): [string, ReadonlyArray<string>] => [`awards of ${e}`, names]),
    ];
    const offenders = sets.filter(([, names]) => intersection([...names], [...RETIRED]).length > 0).map(([label]) => label);
    expect(offenders, 'a retired MA stands in a fixed set — choose a replacement').is.empty;
  });

  it('no random mode offers one — under the classic Turmoil, under Redux, or without a Parliament', () => {
    const modes: Array<Partial<GameOptions>> = [
      {randomMA: RandomMAOptionType.LIMITED},
      {randomMA: RandomMAOptionType.UNLIMITED},
      {randomMA: RandomMAOptionType.ALL},
      {randomMA: RandomMAOptionType.LIMITED, modularMA: true},
      {randomMA: RandomMAOptionType.UNLIMITED, modularMA: true},
      {randomMA: RandomMAOptionType.LIMITED, includeFanMA: true},
    ];
    const tables: Array<Partial<GameOptions['expansions']>> = [{turmoil: true}, {turmoilRedux: true, colonies: true}, {}];
    for (const mode of modes) {
      for (const table of tables) {
        const [milestones, awards] = getCandidates(options(mode, table));
        expect(intersection<string>([...milestones, ...awards], [...RETIRED]), `${JSON.stringify(mode)} × ${JSON.stringify(table)}`).is.empty;
      }
    }
  });

  it('a fixed set that starts naming one fails at game creation, naming it', () => {
    const tharsis = milestoneManifest.boards[BoardName.THARSIS] as Array<MilestoneName>;
    tharsis.push('Lobbyist');
    try {
      expect(() => chooseMilestonesAndAwards(options({boardName: BoardName.THARSIS, randomMA: RandomMAOptionType.NONE}, {})))
        .to.throw(/Retired milestone\/award reached a new game: Lobbyist/);
    } finally {
      tharsis.pop();
    }
    expect(chooseMilestonesAndAwards(options({boardName: BoardName.THARSIS, randomMA: RandomMAOptionType.NONE}, {})).milestones)
      .to.not.include('Lobbyist');
  });

  it('nothing else in src/ spells a retired name — a card or a mode that leans on one surfaces here', () => {
    const pattern = new RegExp(`['"\`](${RETIRED.join('|')})['"\`]`);
    const offenders: Array<string> = [];
    for (const file of sourceFiles(SRC, [])) {
      const rel = path.relative(SRC, file);
      if (ALLOWED.has(rel)) {
        continue;
      }
      fs.readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        if (pattern.test(line)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'a retired MA is referenced — decide its replacement:\n  ' + offenders.join('\n  ')).is.empty;
  });

  it('an old save still loads them (the factories stay)', () => {
    expect(milestoneManifest.createOrThrow('Lobbyist').name).eq('Lobbyist');
    expect(awardManifest.createOrThrow('Politician').name).eq('Politician');
  });
});
