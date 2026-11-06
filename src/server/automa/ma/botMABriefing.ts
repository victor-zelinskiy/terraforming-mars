import {Message} from '../../../common/logs/Message';
import {LogMessageData} from '../../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../../common/logs/LogMessageDataType';
import {Tag} from '../../../common/cards/Tag';
import {BotMilestoneThreshold, BotRuleLine} from '../../../common/models/MarsBotModel';
import {IGame} from '../../IGame';
import {AwardName} from '../../../common/ma/AwardName';
import {MilestoneName} from '../../../common/ma/MilestoneName';
import {botAwardRule, botMilestoneRule, milestoneCriterion, resolveTrackIndex} from './botMAInterpreter';
import {describeAward, describeAwardHelper, describeMilestone, trackLabel} from './botMADescribe';
import {milestoneThreshold} from '../../milestones/IMilestone';
import {PlacementBias} from './BotMARule';
import {matBase, topologyOf} from './matGenerator';

/**
 * WHAT THE PLAYER READS about the bot's milestones and awards — every line generated from the registry and the mat
 * (never a hand table): the bot's criterion next to each milestone row, its score and its Corporate Competition push
 * next to each award row, the threshold MARK on the track cell each single-track milestone needs (decision R6), and —
 * for a random set — the BRIEFING: what the set changed on the bot's mat and in its placements, one sentence each.
 */
export function botRuleLines(game: IGame): Array<BotRuleLine> {
  const lines: Array<BotRuleLine> = [];
  for (const milestone of game.milestones) {
    const criterion = describeMilestone(milestone, game);
    if (criterion !== undefined) {
      lines.push({kind: 'milestone', name: milestone.name, criterion});
    }
  }
  for (const award of game.awards) {
    const score = describeAward(award.name);
    if (score !== undefined) {
      lines.push({kind: 'award', name: award.name, criterion: score, helper: describeAwardHelper(award.name)});
    }
  }
  return lines;
}

/**
 * The cell each single-track milestone needs (decision R6): the track its criterion reads on THIS mat and the
 * threshold — the target, a constant of the name (R3). A «max of two tracks» criterion marks both.
 */
export function botMilestoneThresholds(game: IGame): Array<BotMilestoneThreshold> {
  const board = game.automa?.board;
  if (board === undefined) {
    return [];
  }
  // Once every milestone slot is taken a mark promises a claim nobody can make.
  if (game.allMilestonesClaimed()) {
    return [];
  }
  const marks: Array<BotMilestoneThreshold> = [];
  for (const milestone of game.milestones) {
    const rule = botMilestoneRule(milestone.name);
    if (rule === undefined || rule.target === undefined || game.milestoneClaimed(milestone)) {
      continue;
    }
    const target = rule.target === 'printed' ? milestoneThreshold(milestone, game) : rule.target;
    const criterion = milestoneCriterion(rule, game);
    const refs = criterion.kind === 'track' && (criterion.times ?? 1) === 1 && (criterion.div ?? 1) === 1 && (criterion.plus ?? 0) === 0 ?
      [criterion.track] :
      criterion.kind === 'tracks' && criterion.op === 'max' && typeof criterion.of !== 'string' ? criterion.of : [];
    for (const ref of refs) {
      const trackIndex = resolveTrackIndex(board, ref);
      // Two refs of one criterion may ride ONE track on this mat (Farmer's Microbe and Animal on a bio row) — one mark.
      if (trackIndex !== undefined && target !== undefined && target <= board.tracks[trackIndex].maxPosition &&
          !marks.some((m) => m.trackIndex === trackIndex && m.cell === target && m.milestone === milestone.name)) {
        marks.push({trackIndex, cell: target, milestone: milestone.name as MilestoneName});
      }
    }
  }
  return marks;
}

function label(text: string): LogMessageData {
  return {type: LogMessageDataType.STRING, value: text};
}

function milestoneToken(name: string): LogMessageData {
  return {type: LogMessageDataType.MILESTONE, value: name as MilestoneName};
}

function awardToken(name: string): LogMessageData {
  return {type: LogMessageDataType.AWARD, value: name as AwardName};
}

const PLACEMENT_LABEL: Record<string, string> = {
  'polar-region': 'the two bottom rows',
  'southern-region': 'the Southern Region',
  'equatorial-region': 'the equatorial rows',
  'empty-neighbours': 'cells with empty neighbours',
  'own-city': 'cells beside its own cities',
  'special-tile': 'cells beside special tiles',
  'edge': 'the board edge',
  'suburbianEdge': 'the edge of the map',
  'volcanicOrAdjacent': 'the volcanic areas and their neighbours',
  'specialTileAdjacent': 'cells beside special tiles',
};

/**
 * THE SET'S BRIEFING (a random-set game only — a fixed row plays its printed board): one sentence per thing the set
 * CHANGED — a floating tag moved to another track (and why), each tile rule's placement bias, the token / colony cells.
 * Nothing that is already plain on the mat is repeated.
 */
export function botSetBriefing(game: IGame): Array<Message> {
  const mat = game.automa?.mat;
  if (mat === undefined) {
    return [];
  }
  const out: Array<Message> = [];
  const {profile: base} = matBase(game.gameOptions.boardName);
  if (mat.report.baseIsFallback) {
    out.push({message: 'This map has no MarsBot board of its own — the bot plays the Tharsis board, re-cut for this set', data: []});
  }
  const before = topologyOf(base.tracks);
  const after = topologyOf(mat.tracks);
  const moves: Array<[Tag, string, string]> = [[Tag.JOVIAN, before.jovian, after.jovian], [Tag.CITY, before.city, after.city], [Tag.MICROBE, before.microbe, after.microbe]];
  for (const [tag, from, to] of moves) {
    if (from !== to) {
      out.push({message: 'For this set the ${0} moves to ${1}', data: [label(`the ${tag} tag`), label(trackLabel({role: to as 'science'}))]});
    }
  }
  for (const name of [...game.milestones.map((m) => m.name), ...game.awards.map((a) => a.name)]) {
    const isMilestone = game.milestones.some((m) => m.name === name);
    const placement: PlacementBias | undefined = isMilestone ? botMilestoneRule(name)?.placement : botAwardRule(name)?.placement;
    if (placement === undefined) {
      continue;
    }
    const token = isMilestone ? milestoneToken(name) : awardToken(name);
    // WHAT THE MAT PLAYS, never what the rule's row would ask for alone: only ONE rule of a set competes with the
    // icons (`placementOf`), every later one is demoted to a step after them — and the briefing used to state the
    // declared form of each (a set with Polar Explorer, Highlander and Suburbian said «no longer seeks the oceans
    // first» and «counts the edge as one more icon» about a mat that does neither — the review of 2026-11-06).
    const played = mat.placement;
    const towards = (where: string) =>
      out.push({message: 'For ${0} the bot places its tiles towards ${1}', data: [token, label(PLACEMENT_LABEL[where] ?? where)]});
    switch (placement.mode) {
    case 'step-before-icons':
    case 'step-after-icons':
      // Before the icons or after them, the step is a preference towards the region — true of both forms.
      if (played === undefined || played.steps.includes(placement.step)) {
        towards(placement.step);
      }
      break;
    case 'icon-bonus':
      if (played === undefined || played.iconBonus.includes(placement.region)) {
        out.push({message: 'For ${0} the bot counts ${1} as one more bonus icon', data: [token, label(PLACEMENT_LABEL[placement.region] ?? placement.region)]});
      } else if (played.steps.includes(`region:${placement.region}`)) {
        towards(placement.region);
      }
      break;
    case 'lower-oceans':
      // Said only when the oceans really stand below the icons on this mat; a demoted rule changes nothing.
      if (played === undefined || played.steps.indexOf('oceans') > played.steps.indexOf('reward-icons')) {
        out.push({message: 'For ${0} the bot no longer seeks the oceans first', data: [token]});
      }
      break;
    }
  }
  const tokenCells = mat.tracks.flatMap((t) => t.layout).filter((a) => a !== undefined && a.startsWith('token'));
  for (const [kind, milestone] of [['data', 'Dataminer'], ['fighter', 'Aeronaut']] as const) {
    if (tokenCells.some((a) => a?.endsWith(`_${kind}`))) {
      out.push({message: 'Token cells on its tracks count for ${0}', data: [milestoneToken(milestone)]});
    }
  }
  if (mat.report.repairs.some((r) => r.startsWith('colony'))) {
    out.push({message: 'Colony cells on its tracks build a colony for 5 M€', data: []});
  }
  return out;
}
