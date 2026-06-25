import {expect} from 'chai';
import {awardManifest} from '../../src/server/awards/Awards';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {chooseMilestonesAndAwards, getCandidates, LIMITED_SYNERGY, maximumSynergy, verifySynergyRules} from '../../src/server/ma/MilestoneAwardSelector';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {intersection} from '../../src/common/utils/utils';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../src/server/game/GameOptions';
import {BoardName} from '../../src/common/boards/BoardName';
import {AwardName} from '../../src/common/ma/AwardName';
import {MilestoneName} from '../../src/common/ma/MilestoneName';

describe('MilestoneAwardSelector', () => {
  const maximumSynergyRuns = [
    // Gardener / Landlord have synergy 6.
    {mas: [...milestoneManifest.boards[BoardName.THARSIS], ...awardManifest.boards[BoardName.THARSIS]], expected: 6},
    // DesertSettler / Estate Dealer has synergy 5.
    {mas: [...milestoneManifest.boards[BoardName.ELYSIUM], ...awardManifest.boards[BoardName.ELYSIUM]], expected: 5},
    // Both pairs Polar Explorer / Cultivator and Rim Settler / Space Baron
    // have synergy 3.
    {mas: [...milestoneManifest.boards[BoardName.HELLAS], ...awardManifest.boards[BoardName.HELLAS]], expected: 3},
    // Hoverlord / Venuphine have synergy 5.
    {mas: [...milestoneManifest.expansions['venus'], ...awardManifest.expansions['venus']], expected: 5},
  ] as const;
  // These aren't particularly excellent tests as much as they help demonstrate
  // what the original maps, if selected in full, would have as a synergy.
  maximumSynergyRuns.forEach((run, idx) => {
    it('Compute maximum synergy ' + idx, () => {
      const mas: ReadonlyArray<MilestoneName | AwardName> = run.mas;
      expect(maximumSynergy(mas)).to.eq(run.expected);
    });
  });

  const verifySynergyRuns = [
    // vize1215 fork: Tharsis now uses Terraformer29 (which has no synergy-table entries) instead
    // of Terraformer, dropping the total synergy from 21 to 17, so the set no longer breaks the rules.
    {milestones: milestoneManifest.boards[BoardName.THARSIS], awards: awardManifest.boards[BoardName.THARSIS], expected: true},
    // Elysium milestones and awards has total synergy of 13 and two high pairs of 4 and 5.
    // This set does not break the rules.
    {milestones: milestoneManifest.boards[BoardName.ELYSIUM], awards: awardManifest.boards[BoardName.ELYSIUM], expected: true},
    // Hellas milestones and awards has total synergy of 11 and no high pair. It does not break the rules.
    {milestones: milestoneManifest.boards[BoardName.HELLAS], awards: awardManifest.boards[BoardName.HELLAS], expected: true},
  ] as const;
  // These aren't particularly excellent tests as much as they help demonstrate
  // what the original maps, if selected in full, would have as a synergy.
  verifySynergyRuns.forEach((run, idx) => {
    it('Verify limited synergy ' + idx, () => {
      expect(verifySynergyRules(run.milestones, run.awards, LIMITED_SYNERGY)).to.eq(run.expected);
    });
  });

  it('Hellas milestones and awards break stringent limited synergy rules', () => {
    // Hellas milestones and awards break rules if allowed no synergy whatsoever.
    expect(verifySynergyRules(
      milestoneManifest.boards[BoardName.HELLAS], awardManifest.boards[BoardName.HELLAS],
      {
        highThreshold: 10,
        maxSynergyAllowed: 0,
        numberOfHighAllowed: 0,
        totalSynergyAllowed: 0,
      })).eq(false);
  });

  const sanityTestRuns = [
    {options: {randomMA: RandomMAOptionType.NONE}},
    {options: {randomMA: RandomMAOptionType.LIMITED}},
    {options: {randomMA: RandomMAOptionType.UNLIMITED}},
    {options: {randomMA: RandomMAOptionType.NONE, moonExpansion: true}},
    {options: {randomMA: RandomMAOptionType.LIMITED, moonExpansion: true}},
    {options: {randomMA: RandomMAOptionType.UNLIMITED, moonExpansion: true}},
    {options: {randomMA: RandomMAOptionType.NONE, aresExtension: true, moonExpansion: true}},
    {options: {randomMA: RandomMAOptionType.LIMITED, aresExtension: true, moonExpansion: true}},
    {options: {randomMA: RandomMAOptionType.UNLIMITED, aresExtension: true, moonExpansion: true}},
  ] as const;
  sanityTestRuns.forEach((run, idx) => {
    it('sanity test run ' + idx, () => {
      // These tests don't test results, they just make sure these calls don't fail.
      choose(run.options);
    });
  });

  it('Do not select fan milestones or awards when that feature is disabled', () => {
    const avoidedAwards = [
      awardManifest.expansions['ares'],
      awardManifest.expansions['moon'],
      awardManifest.boards[BoardName.AMAZONIS],
      awardManifest.boards[BoardName.ARABIA_TERRA],
      awardManifest.boards[BoardName.TERRA_CIMMERIA],
      awardManifest.boards[BoardName.VASTITAS_BOREALIS]].flat();
    const avoidedMilestones = [
      milestoneManifest.expansions['ares'],
      milestoneManifest.expansions['moon'],
      milestoneManifest.boards[BoardName.AMAZONIS],
      milestoneManifest.boards[BoardName.ARABIA_TERRA],
      milestoneManifest.boards[BoardName.TERRA_CIMMERIA],
      milestoneManifest.boards[BoardName.VASTITAS_BOREALIS]].flat();
    for (let idx = 0; idx < 1_000; idx++) {
      const mas = choose({
        randomMA: RandomMAOptionType.UNLIMITED,
        includeFanMA: false,
      });

      expect(intersection(mas.awards, avoidedAwards)).is.empty;
      expect(intersection(mas.milestones, avoidedMilestones)).is.empty;
    }
  });

  it('Do not select expansion milestones or awards when they are not selected', () => {
    const avoidedAwards: Array<AwardName> = [
      awardManifest.expansions['ares'],
      awardManifest.expansions['moon'],
      awardManifest.expansions['venus'],
      awardManifest.expansions['underworld'],
    ].flat();
    const avoidedMilestones = [
      milestoneManifest.expansions['ares'],
      milestoneManifest.expansions['moon'],
      milestoneManifest.expansions['venus'],
      milestoneManifest.expansions['underworld'],
    ].flat();

    avoidedMilestones.push('Pioneer', 'Martian', 'Colonizer');
    avoidedAwards.push('T. Politician');
    const [milestones, awards] = getCandidates({...DEFAULT_GAME_OPTIONS,
      randomMA: RandomMAOptionType.LIMITED,
      venusNextExtension: false,
      aresExtension: false,
      moonExpansion: false,
      coloniesExtension: false,
      turmoilExtension: false,
      includeFanMA: true,
    });

    expect(intersection(awards, avoidedAwards)).is.empty;
    expect(intersection(milestones, avoidedMilestones)).is.empty;
  });

  it('nova maps with no randomness render correctly', () => {
    const mas = chooseMilestonesAndAwards({
      ...DEFAULT_GAME_OPTIONS,
      'aresExtension': true,
      'boardName': BoardName.TERRA_CIMMERIA_NOVA,
      'includeFanMA': false,
      'pathfindersExpansion': true,
      'randomMA': RandomMAOptionType.NONE,
      'venusNextExtension': true,
    });
    expect(mas.milestones).to.have.length(8);
    expect(mas.awards).to.have.length(8);
  });

  it('Do not select Constructor when Colonies is not selected', () => {
    for (let idx = 0; idx < 1_000; idx++) {
      const mas = chooseMilestonesAndAwards({
        ...DEFAULT_GAME_OPTIONS,
        coloniesExtension: false,
        randomMA: RandomMAOptionType.LIMITED,
      });
      expect(mas.awards).does.not.contain('Constructor');
    }
  });

  // it('No modular milestones and awards by default', () => {
  //   const [milestones, awards] = getCandidates({...DEFAULT_GAME_OPTIONS,
  //     randomMA: RandomMAOptionType.UNLIMITED,
  //     venusNextExtension: true,
  //     aresExtension: true,
  //     moonExpansion: true,
  //     coloniesExtension: true,
  //     turmoilExtension: true,
  //     includeFanMA: true,
  //   });

  //   // expect(intersection(milestones, milestoneManifest.modular)).deep.eq([]);
  //   // expect(intersection(awards, awardManifest.modular)).deep.eq([]);

  //   // Landlord is listed as modular, but should be included here.
  //   expect(awards).to.contain('Landlord');
  // });

  it('Do not select deprecated milestones or awards', () => {
    const [milestones, awards] = getCandidates({
      ...DEFAULT_GAME_OPTIONS,
      randomMA: RandomMAOptionType.UNLIMITED,
      includeFanMA: true,
    });

    const deprecatedMilestones = Object.keys(milestoneManifest.all).filter(
      (name) => milestoneManifest.all[name as MilestoneName].deprecated,
    );
    const deprecatedAwards = Object.keys(awardManifest.all).filter(
      (name) => awardManifest.all[name as AwardName].deprecated,
    );

    expect(intersection(milestones as Array<string>, deprecatedMilestones)).is.empty;
    expect(intersection(awards as Array<string>, deprecatedAwards)).is.empty;
  });

  describe('vize1215 unified "all" pool (RandomMAOptionType.ALL)', () => {
    // The clone variants that are dropped from the unified pool (the other threshold is kept).
    const CLONE_EXCLUSIONS = ['Terraformer', 'Tycoon', 'Spacefarer4', 'Builder7', 'Terran5', 'Legend4', 'Tactician4', 'Pioneer4'];

    it('board defaults use Terraformer29 / Tycoon10', () => {
      expect(milestoneManifest.boards[BoardName.THARSIS]).to.include('Terraformer29');
      expect(milestoneManifest.boards[BoardName.THARSIS]).to.not.include('Terraformer');
      expect(milestoneManifest.boards[BoardName.ELYSIUM]).to.include('Tycoon10');
      expect(milestoneManifest.boards[BoardName.ELYSIUM]).to.not.include('Tycoon');
    });

    it('never offers both halves of a clone pair, keeps the chosen variant', () => {
      const [milestones] = getCandidates({
        ...DEFAULT_GAME_OPTIONS,
        randomMA: RandomMAOptionType.ALL,
        expansions: {
          ...DEFAULT_GAME_OPTIONS.expansions,
          venus: true, ares: true, moon: true, colonies: true, turmoil: true, underworld: true, pathfinders: true,
        },
      });
      for (const excluded of CLONE_EXCLUSIONS) {
        expect(milestones, `should exclude ${excluded}`).to.not.include(excluded);
      }
      // The kept halves are present.
      for (const kept of ['Terraformer29', 'Tycoon10', 'Spacefarer', 'Builder', 'Terran', 'Legend', 'Tactician', 'Pioneer']) {
        expect(milestones, `should include ${kept}`).to.include(kept);
      }
    });

    it('includes fan and modular milestones (compatible, untagged) without the fan toggle', () => {
      const [milestones] = getCandidates({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.ALL, includeFanMA: false});
      expect(milestones).to.include('Producer'); // genuinely-new modular milestone (Trader is now a deprecated clone of Tradesman)
      expect(milestones).to.include('Economizer'); // fan-board milestone
    });

    it('respects enabled expansions', () => {
      const [milestones, awards] = getCandidates({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.ALL});
      expect(milestones).to.not.include('Hoverlord'); // venus, disabled
      expect(milestones).to.not.include('One Giant Step'); // moon, disabled
      expect(awards).to.not.include('Constructor'); // colonies, disabled
    });

    it('does not select deprecated milestones or awards', () => {
      const [milestones, awards] = getCandidates({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.ALL});
      const deprecatedMilestones = Object.keys(milestoneManifest.all).filter((name) => milestoneManifest.all[name as MilestoneName].deprecated);
      const deprecatedAwards = Object.keys(awardManifest.all).filter((name) => awardManifest.all[name as AwardName].deprecated);
      expect(intersection(milestones as Array<string>, deprecatedMilestones)).is.empty;
      expect(intersection(awards as Array<string>, deprecatedAwards)).is.empty;
    });

    it('chooses the required count with no synergy filter and no clones', () => {
      for (let idx = 0; idx < 200; idx++) {
        const mas = chooseMilestonesAndAwards({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.ALL});
        expect(mas.milestones).to.have.length(5);
        expect(mas.awards).to.have.length(5);
        expect(intersection(mas.milestones, CLONE_EXCLUSIONS as Array<MilestoneName>)).is.empty;
      }
    });

    it('excludes Geologist on a board with no volcanic spaces', () => {
      const withVolcanic = getCandidates({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.ALL}, {hasVolcanicSpaces: true});
      const noVolcanic = getCandidates({...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.ALL}, {hasVolcanicSpaces: false});
      expect(withVolcanic[0]).to.include('Geologist');
      expect(noVolcanic[0]).to.not.include('Geologist');
    });

    it('boards without a fixed set (Hollandia, NONE mode) draw from the unified pool', () => {
      for (let idx = 0; idx < 100; idx++) {
        const mas = chooseMilestonesAndAwards(
          {...DEFAULT_GAME_OPTIONS, randomMA: RandomMAOptionType.NONE, boardName: BoardName.HOLLANDIA},
          {hasVolcanicSpaces: false}, // Hollandia has no volcanic spaces
        );
        expect(mas.milestones).to.have.length(5);
        expect(mas.awards).to.have.length(5);
        expect(intersection(mas.milestones, CLONE_EXCLUSIONS as Array<MilestoneName>)).is.empty;
        expect(mas.milestones).to.not.include('Geologist'); // unclaimable here, never offered
      }
    });
  });

  function choose(options: Partial<GameOptions>) {
    return chooseMilestonesAndAwards({...DEFAULT_GAME_OPTIONS, ...options});
  }
});
