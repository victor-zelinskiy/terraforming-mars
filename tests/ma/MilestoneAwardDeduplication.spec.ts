import {expect} from 'chai';
import {awardManifest} from '../../src/server/awards/Awards';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {chooseMilestonesAndAwards, getCandidates} from '../../src/server/ma/MilestoneAwardSelector';
import {MAName, RANDOM_EXCLUSION_GROUPS, randomExclusionGroup} from '../../src/server/ma/MilestoneAwardExclusions';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../src/server/game/GameOptions';
import {MilestoneName, milestoneNames} from '../../src/common/ma/MilestoneName';
import {AwardName, awardNames} from '../../src/common/ma/AwardName';
import {BoardName} from '../../src/common/boards/BoardName';
import milestonesRu from '../../src/locales/ru/milestones.json';
import awardsRu from '../../src/locales/ru/awards.json';

// The two locale files that hold every milestone/award display name (merged at runtime by the i18n
// loader). Read here directly so the test fails the moment a poolable milestone/award lacks a Russian
// name or two poolable ones collide.
const RU: Record<string, string> = {...milestonesRu, ...awardsRu};

// Mirror the client's display-name resolution (Milestone.vue / MilestonesOverlay.vue strip a trailing
// digit so Terraformer29 reads as "Terraformer" -> "Колонист"), then look the result up in the RU dict.
function stripTrailingDigits(name: string): string {
  return name.replace(/[0-9]+$/, '');
}
function russianName(name: string): string {
  return RU[name] ?? RU[stripTrailingDigits(name)] ?? stripTrailingDigits(name);
}
// Normalize per the audit spec: trim, case-insensitive, ё == е, collapse whitespace.
function normalizeRu(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function allExpansions(extra: Partial<GameOptions> = {}): GameOptions {
  return {
    ...DEFAULT_GAME_OPTIONS,
    venusNextExtension: true,
    aresExtension: true,
    moonExpansion: true,
    coloniesExtension: true,
    turmoilExtension: true,
    pathfindersExpansion: true,
    includeFanMA: true,
    expansions: {
      ...DEFAULT_GAME_OPTIONS.expansions,
      venus: true, ares: true, moon: true, colonies: true, turmoil: true, underworld: true, pathfinders: true,
    },
    ...extra,
  };
}

describe('Milestone/Award random-pool de-duplication (vize1215 fork)', () => {
  describe('exclusion-group metadata integrity', () => {
    it('every grouped name is a real milestone or award', () => {
      const valid = new Set<string>([...milestoneNames, ...awardNames]);
      for (const [group, names] of Object.entries(RANDOM_EXCLUSION_GROUPS)) {
        for (const name of names) {
          expect(valid.has(name), `${name} in group ${group} is not a known milestone/award`).to.be.true;
        }
      }
    });

    it('each milestone/award belongs to at most one group', () => {
      const seen = new Set<MAName>();
      for (const names of Object.values(RANDOM_EXCLUSION_GROUPS)) {
        for (const name of names) {
          expect(seen.has(name), `${name} appears in more than one exclusion group`).to.be.false;
          seen.add(name);
        }
      }
    });

    it('no grouped name is deprecated (a deprecated clone never reaches the pool, so grouping it is dead metadata)', () => {
      for (const names of Object.values(RANDOM_EXCLUSION_GROUPS)) {
        for (const name of names) {
          const spec = milestoneNames.includes(name as MilestoneName) ?
            milestoneManifest.all[name as MilestoneName] :
            awardManifest.all[name as AwardName];
          expect(spec.deprecated, `${name} is deprecated but listed in an exclusion group`).to.not.equal(true);
        }
      }
    });
  });

  describe('Russian name uniqueness in the random pool', () => {
    it('no two pool candidates share a Russian name unless they are in the same exclusion group', () => {
      const [milestones, awards] = getCandidates(allExpansions({randomMA: RandomMAOptionType.ALL}));
      const candidates: ReadonlyArray<MAName> = [...milestones, ...awards];

      const byName = new Map<string, Array<MAName>>();
      for (const name of candidates) {
        const key = normalizeRu(russianName(name));
        const list = byName.get(key) ?? [];
        list.push(name);
        byName.set(key, list);
      }

      for (const [ruName, members] of byName.entries()) {
        if (members.length === 1) {
          continue;
        }
        // A collision is only acceptable when every colliding MA shares ONE exclusion group, which
        // guarantees the selector never offers two of them in the same game.
        const groups = new Set(members.map((m) => randomExclusionGroup(m)));
        expect(groups.size, `Russian name "${ruName}" is shared by ${members.join(', ')} across different ` +
          `exclusion groups; rename one or group them`).to.equal(1);
        expect([...groups][0], `Russian name "${ruName}" is shared by ${members.join(', ')} but none are in an ` +
          `exclusion group; rename one or group them`).to.not.be.undefined;
      }
    });

    it('every pool candidate has a Russian name (no untranslated latin name leaks into the pool)', () => {
      const [milestones, awards] = getCandidates(allExpansions({randomMA: RandomMAOptionType.ALL}));
      for (const name of [...milestones, ...awards]) {
        const ru = russianName(name);
        expect(/[a-zA-Z]/.test(ru), `${name} has no Russian translation (resolves to "${ru}")`).to.be.false;
      }
    });
  });

  describe('the selector never offers two MAs from the same exclusion group', () => {
    for (const mode of [RandomMAOptionType.LIMITED, RandomMAOptionType.UNLIMITED, RandomMAOptionType.ALL] as const) {
      it(`"${mode}" mode, 1000 draws`, () => {
        for (let i = 0; i < 1000; i++) {
          const mas = chooseMilestonesAndAwards(allExpansions({randomMA: mode}));
          const picked: ReadonlyArray<MAName> = [...mas.milestones, ...mas.awards];
          const groups = picked.map((m) => randomExclusionGroup(m)).filter((g): g is string => g !== undefined);
          expect(new Set(groups).size, `two MAs from the same group were offered together: ${picked.join(', ')}`)
            .to.equal(groups.length);
          // Also no duplicate name within a single game (the player-visible guarantee).
          const ruNames = picked.map((m) => normalizeRu(russianName(m)));
          expect(new Set(ruNames).size, `duplicate Russian name in one game: ${picked.join(', ')}`)
            .to.equal(ruNames.length);
        }
      });
    }

    it('modular MA mode, 1000 draws', () => {
      for (let i = 0; i < 1000; i++) {
        const mas = chooseMilestonesAndAwards(allExpansions({randomMA: RandomMAOptionType.UNLIMITED, modularMA: true}));
        const picked: ReadonlyArray<MAName> = [...mas.milestones, ...mas.awards];
        const groups = picked.map((m) => randomExclusionGroup(m)).filter((g): g is string => g !== undefined);
        expect(new Set(groups).size, `two MAs from the same group: ${picked.join(', ')}`).to.equal(groups.length);
        const ruNames = picked.map((m) => normalizeRu(russianName(m)));
        expect(new Set(ruNames).size, `duplicate Russian name in one game: ${picked.join(', ')}`).to.equal(ruNames.length);
      }
    });
  });

  describe('the known conflicts are resolved', () => {
    it('ТОРГОВЕЦ: only Tradesman remains the canonical "Торговец"; Trader is deprecated, Merchant is renamed', () => {
      expect(milestoneManifest.all['Trader'].deprecated, 'Trader should be deprecated').to.equal(true);
      expect(normalizeRu(russianName('Tradesman'))).to.equal('торговец');
      expect(normalizeRu(russianName('Merchant'))).to.not.equal('торговец');
      const [milestones] = getCandidates(allExpansions({randomMA: RandomMAOptionType.ALL}));
      const tradesmen = milestones.filter((m) => normalizeRu(russianName(m)) === 'торговец');
      expect(tradesmen, 'exactly one "Торговец" milestone in the pool').to.deep.equal(['Tradesman']);
    });

    it('ЗООЛОГ: Zoologist and A. Zoologist share one exclusion group, so they never co-occur', () => {
      expect(randomExclusionGroup('Zoologist')).to.equal('animal-microbe-resources');
      expect(randomExclusionGroup('A. Zoologist')).to.equal('animal-microbe-resources');
      for (let i = 0; i < 500; i++) {
        const mas = chooseMilestonesAndAwards(allExpansions({randomMA: RandomMAOptionType.ALL}));
        const both = mas.awards.includes('Zoologist') && mas.awards.includes('A. Zoologist');
        expect(both, 'Zoologist and A. Zoologist offered together').to.be.false;
      }
    });

    it('Smith / Blacksmith (both "Кузнец") never co-occur', () => {
      for (let i = 0; i < 500; i++) {
        const mas = chooseMilestonesAndAwards(allExpansions({randomMA: RandomMAOptionType.ALL}));
        const both = mas.milestones.includes('Smith') && mas.awards.includes('Blacksmith');
        expect(both, 'Smith and Blacksmith offered together').to.be.false;
      }
    });

    it('Metallurgist (steel+titanium clone of Smith) is deprecated', () => {
      expect(milestoneManifest.all['Metallurgist'].deprecated).to.equal(true);
      const [milestones] = getCandidates(allExpansions({randomMA: RandomMAOptionType.ALL}));
      expect(milestones).to.not.include('Metallurgist');
    });

    it('Terraformer / Tycoon (clones with no board home) are deprecated and never offered', () => {
      expect(milestoneManifest.all['Terraformer'].deprecated).to.equal(true);
      expect(milestoneManifest.all['Tycoon'].deprecated).to.equal(true);
      for (const mode of [RandomMAOptionType.LIMITED, RandomMAOptionType.ALL] as const) {
        const [milestones] = getCandidates(allExpansions({randomMA: mode}));
        expect(milestones, `${RandomMAOptionType[mode]}`).to.not.include('Terraformer');
        expect(milestones, `${RandomMAOptionType[mode]}`).to.not.include('Tycoon');
      }
    });
  });

  describe('fixed/NONE board sets are unaffected (the official layouts must not change)', () => {
    const officialBoards = [BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM] as const;
    for (const boardName of officialBoards) {
      it(`${boardName} NONE-mode set is exactly the manifest layout`, () => {
        const mas = chooseMilestonesAndAwards({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.NONE, boardName});
        expect(mas.milestones).to.deep.equal([...milestoneManifest.boards[boardName]]);
        expect(mas.awards).to.deep.equal([...awardManifest.boards[boardName]]);
      });
    }
  });
});
