import {expect} from 'chai';
import {BoardName} from '../../../src/common/boards/BoardName';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {AutomaSetup} from '../../../src/server/automa/AutomaSetup';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../../src/server/automa/boards/MarsBotMapProfile';
import {botMilestoneThresholds, botSetBriefing} from '../../../src/server/automa/ma/botMABriefing';
import {describeMilestone} from '../../../src/server/automa/ma/botMADescribe';
import {botMilestoneRule} from '../../../src/server/automa/ma/botMAInterpreter';
import {criterionRoles, topologyOf} from '../../../src/server/automa/ma/matGenerator';
import {testAutomaGame} from '../AutomaTestGame';
import {testAutomaRandomSetGame} from './matTestGame';

/**
 * THE REVIEW OF THE RANDOM-SET FRAMEWORK (2026-11-06, docs/claude/marsbot-dynamic-ma-progress.md § Ревью) — one test
 * per defect it found and fixed, so none of them comes back: the mat depending on the deal, the briefing describing a
 * placement the mat does not play, a criterion line naming a track the game has not got, doubled / stale threshold
 * marks. (Visionary's helper and Tactician4's 30 M€ are pinned beside their rules — the fan Vastitas spec and
 * `botMAStage2Rules`; the hazard clearance — `AutomaHazardClearance`.) And the SCOPE of the «no jump» law, read off the
 * printed boards themselves.
 */
const FILL = {milestones: ['Mayor', 'Gardener', 'Builder'], awards: ['Banker', 'Scientist', 'Thermalist']} as const;

describe('the random-set framework — the review\'s fixes', () => {
  it('the mat is a function of the set, the map and the options — never of the DEAL', () => {
    const set = {milestones: ['Firestarter', 'Rim Settler', ...FILL.milestones], awards: ['Landlord', 'Miner', ...FILL.awards]};
    const mats = new Set<string>();
    const mixes = new Set<string>();
    for (const seed of [0.07, 0.19, 0.31, 0.43, 0.59, 0.71, 0.83, 0.97]) {
      const [game] = testAutomaRandomSetGame(set, {seed}, `-review-deal-${seed}`);
      mats.add(JSON.stringify(game.automa!.mat));
      mixes.add(JSON.stringify(AutomaSetup.deckTagMix(game)));
    }
    expect(mixes.size, 'the deck mix is the game\'s card set — a shuffle and a deal move nothing in it').eq(1);
    expect(mats.size, 'eight deals, one mat').eq(1);
  });

  it('the briefing states the placement the MAT plays — a demoted rule is never described by its declared form', () => {
    // Three rules that would each compete with the icons: only the first one in row order does (Polar Explorer's step
    // before them); Highlander's lowered oceans and Suburbian's «+1 icon» are demoted to steps after the icons.
    const set = {milestones: ['Polar Explorer', 'Tropicalist', ...FILL.milestones], awards: ['Highlander', 'Suburbian', ...FILL.awards]};
    const [game] = testAutomaRandomSetGame(set, {}, '-review-briefing');
    const placement = game.automa!.mat!.placement;
    expect(placement.steps[0], 'the oceans stay first on this mat').eq('oceans');
    expect(placement.iconBonus, 'no «+1 icon» region on this mat').deep.eq([]);

    const lines = botSetBriefing(game);
    const about = (name: string) => lines.filter((m) => m.data.some((d) => d.value === name)).map((m) => m.message);
    expect(about('Highlander'), 'the oceans are NOT lowered — nothing to say').deep.eq([]);
    expect(about('Suburbian'), 'a preference after the icons, never an extra icon')
      .deep.eq(['For ${0} the bot places its tiles towards ${1}']);
    expect(about('Polar Explorer')).deep.eq(['For ${0} the bot places its tiles towards ${1}']);
    expect(lines.some((m) => m.message === 'For ${0} the bot counts ${1} as one more bonus icon')).is.false;
    expect(lines.some((m) => m.message === 'For ${0} the bot no longer seeks the oceans first')).is.false;

    // …and a set where Highlander is the ONE competing rule says so, because there the mat really plays it.
    const [alone] = testAutomaRandomSetGame({milestones: ['Mayor', 'Gardener', 'Builder', 'Planner', 'Terraformer'],
      awards: ['Highlander', 'Banker', 'Scientist', 'Thermalist', 'Miner']}, {}, '-review-briefing-alone');
    expect(alone.automa!.mat!.placement.steps.indexOf('oceans')).is.greaterThan(alone.automa!.mat!.placement.steps.indexOf('reward-icons'));
    expect(botSetBriefing(alone).some((m) => m.message === 'For ${0} the bot no longer seeks the oceans first')).is.true;
  });

  it('Tradesman\'s line names only the tracks the game HAS — no «Venus track» without Venus Next', () => {
    const set = {milestones: ['Tradesman', 'Mayor', 'Gardener', 'Builder', 'Planner'], awards: ['Banker', 'Scientist', 'Thermalist', 'Miner', 'Landlord']};
    const line = (venusNextExtension: boolean) => {
      const [game] = testAutomaRandomSetGame(set, {venusNextExtension}, `-review-tradesman-${venusNextExtension}`);
      return describeMilestone(game.milestones.find((m) => m.name === 'Tradesman')!, game)!;
    };
    const plain = line(false);
    expect(plain.message).eq('MarsBot: ${0} and ${1} each at space ${2}');
    expect(plain.data.map((d) => String(d.value)).some((v) => /Venus/i.test(v)), 'no track the game has not got').is.false;
    expect(line(true).message).eq('MarsBot: ${0}, ${1} and ${2} each at space ${3}');
  });

  it('threshold marks: one per (track, cell, milestone) — and none once every milestone slot is taken', () => {
    // Farmer reads «the Microbe- or the Animal-tag track»; on a mat where both ride the bio row that is ONE cell.
    const set = {milestones: ['Farmer', 'Mayor', 'Gardener', 'Builder', 'Planner'], awards: ['Banker', 'Scientist', 'Thermalist', 'Miner', 'Landlord']};
    const [game, human] = testAutomaRandomSetGame(set, {}, '-review-marks');
    const marks = botMilestoneThresholds(game);
    const farmer = marks.filter((m) => m.milestone === 'Farmer');
    expect(new Set(farmer.map((m) => `${m.trackIndex}:${m.cell}`)).size, 'no duplicate mark').eq(farmer.length);
    expect(farmer.length).is.at.least(1);
    for (const name of ['Mayor', 'Gardener', 'Builder']) {
      game.claimedMilestones.push({player: human, milestone: game.milestones.find((m) => m.name === name)!});
    }
    expect(botMilestoneThresholds(game), 'nothing left to claim — nothing marked').deep.eq([]);
  });
});

describe('the «no jump» law — its scope, read off the printed boards', () => {
  it('a SINGLE-TRACK milestone of a printed row is never one «advance» from its threshold — except the one known fan cell', () => {
    // The law binds a criterion the player reads as ONE cube against ONE mark (a `track`, or «the higher of two»): the
    // six official boards keep it for every such milestone of their own rows.
    const jumps: Array<string> = [];
    for (const board of MARSBOT_BOARDS) {
      const profile = marsBotMapProfile(board);
      if (profile.borrowedBoard !== undefined) {
        continue;
      }
      const t = topologyOf(profile.tracks);
      for (const name of milestoneManifest.boards[board]) {
        const rule = botMilestoneRule(name);
        if (rule === undefined || typeof rule.target !== 'number') {
          continue;
        }
        const criterion = rule.criterion;
        const single = criterion.kind === 'track' || (criterion.kind === 'tracks' && criterion.op === 'max' && typeof criterion.of !== 'string');
        if (!single) {
          continue;
        }
        for (const role of criterionRoles(criterion, t)) {
          const row = profile.tracks.find((x) => x.role === role);
          if (row !== undefined && rule.target >= 2 && row.layout[rule.target - 1] === 'advance') {
            jumps.push(`${board}/${name} ${role} ${rule.target - 1}`);
          }
        }
      }
    }
    // The old (fan) Terra Cimmeria prints «advance» on earth 7 before Firestarter's 8 — the home-made board's own cell
    // (a generated mat repairs it; the printed board is the owner's to change — docs/AUTOMA_DATA_AUDIT.md §22.8).
    expect(jumps).deep.eq([`${BoardName.TERRA_CIMMERIA}/Firestarter earth 7`]);
  });

  it('a «weakest of several tracks» milestone is OUTSIDE the law — the official boards print that step themselves', () => {
    // Planner (Tharsis), Diversifier (Hellas), Generalist (Elysium), Tradesman (Utopia): each official board prints an
    // «advance» on the cell before the threshold of a row its own every-track / min milestone reads. Such a criterion
    // has no single mark for the player to read against, and the generator leaves those rows as they are printed —
    // extending the law to them would move four official rows for their own sets (the golden test).
    const printed: Array<string> = [];
    for (const [board, name] of [[BoardName.THARSIS, 'Planner'], [BoardName.HELLAS, 'Diversifier'], [BoardName.ELYSIUM, 'Generalist'],
      [BoardName.UTOPIA_PLANITIA, 'Tradesman']] as const) {
      const profile = marsBotMapProfile(board);
      const rule = botMilestoneRule(name)!;
      expect(rule.criterion.kind === 'tracks' && rule.criterion.op === 'min', `${name} is a min-of-tracks criterion`).is.true;
      const target = rule.target as number;
      if (profile.tracks.some((row) => row.role !== 'venus' && row.layout[target - 1] === 'advance')) {
        printed.push(name);
      }
    }
    expect(printed, 'all four official examples print it').deep.eq(['Planner', 'Diversifier', 'Generalist', 'Tradesman']);
  });
});

describe('the random-set framework — a plain (fixed-row) game is untouched by the review', () => {
  it('Tharsis with its own row deals no mat and no briefing', () => {
    const [game] = testAutomaGame({}, '-review-plain');
    expect(game.automa!.mat).is.undefined;
    expect(botSetBriefing(game)).deep.eq([]);
  });
});
