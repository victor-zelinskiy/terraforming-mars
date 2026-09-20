import {Color} from '@/common/Color';
import {PARLIAMENT_VOTE_COST} from '@/common/parliament/ParliamentTypes';
import {parliamentFlow, parliamentSlotsCarried, parliamentVoteInFlight, VoteSnapshot} from './consoleParliamentFlow';
import {ParliamentSlotVm, ParliamentTileVm, ParliamentViewVm} from './consoleParliamentModel';

/*
 * THE VOTE AS SHOWN — the pure readings the voting area and the delegates
 * zone print while a vote is being decided or is in the air. Every one of
 * them reads the flow record (the snapshot, the cursor, the flight) over the
 * live view, so the counters, the leader, the winner badge and the marked
 * source move on the cube's TOUCHDOWN, never on the packet's.
 */
export type BenchSource = 'lobby' | 'reserve' | 'none';

/** A ribbon past this many delegates collapses into per-owner stacks. */
export const DENSE_RIBBON = 12;
/** ONE cube size for every delegate on a card and on the bench (logical px) — the flight scales by 1. */
export const RIBBON_CUBE = 15;

/** The bench's marked source: the place the next delegate leaves, or none when there is nothing to send. */
export function benchSourceOf(view: ParliamentViewVm, snapshot: VoteSnapshot | undefined): BenchSource {
  if (snapshot !== undefined) {
    return snapshot.source;
  }
  const viewer = view.viewer;
  if (viewer === undefined || !viewer.participates) {
    return 'none';
  }
  if (viewer.lobby) {
    return 'lobby';
  }
  return viewer.reserve > 0 ? 'reserve' : 'none';
}

/**
 * THE BENCH'S WARNING — the sources cannot deliver a delegate: nothing is
 * left, or the next one is a reserve delegate the viewer cannot pay for
 * (the server's verdict is the gate; the M€ comparison only says WHICH
 * words the bench uses — never a rule of its own).
 */
export function benchWarnOf(bench: BenchSource, tile: ParliamentTileVm | undefined, megacredits: number): boolean {
  if (bench === 'none') {
    return true;
  }
  if (bench === 'reserve') {
    return tile !== undefined && !tile.available && megacredits < (tile.cost ?? PARLIAMENT_VOTE_COST);
  }
  return false;
}

/** WHERE the delegate leaves from — the server's own source; past the submit the snapshot's (the menu option is gone by then). */
export function voteSourceOf(view: ParliamentViewVm, snapshot: VoteSnapshot | undefined, tile: ParliamentTileVm | undefined): BenchSource {
  if (snapshot !== undefined) {
    return snapshot.source;
  }
  const source = tile?.source;
  if (source === 'reserve' || source === 'lobby') {
    return source;
  }
  if (view.viewer?.lobby) {
    return 'lobby';
  }
  return (view.viewer?.reserve ?? 0) > 0 ? 'reserve' : 'none';
}

/** A slot's tally as SHOWN: the selected card waits for the touchdown before its numbers move. */
export function tallyShownOf(slot: ParliamentSlotVm, index: number): {votes: number, mine: number, leader: Color | 'neutral' | undefined} {
  const snap = parliamentFlow.voteSnapshot;
  if (snap !== undefined && index === parliamentFlow.slotIndex && parliamentVoteInFlight()) {
    return {votes: snap.votes, mine: snap.mine, leader: snap.leader};
  }
  return {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader};
}

/** Whether a card reads «winning» as SHOWN: while the cube is in the air every card keeps the pre-vote verdict (the badge moves on the touchdown). */
export function winningShownOf(slot: ParliamentSlotVm, decided = false): boolean {
  // The vote is DECIDED (the sitting's steps before the refresh): the winner is named by the
  // summary and the remaining cards are not up for anything yet — the server already re-ranked
  // them for the NEXT vote, so a «принимается» here named a card with no delegates beside the
  // verdict naming another (P-17). The badge returns with the refreshed table.
  if (decided) {
    return false;
  }
  const snap = parliamentFlow.voteSnapshot;
  if (snap !== undefined && parliamentVoteInFlight()) {
    return slot.instance === snap.winner;
  }
  return slot.isWinning;
}

/** The hollow PLACE the next delegate takes: on the selected card, before the answer. */
export function placeShownOn(index: number, benchWarn: boolean): boolean {
  const f = parliamentFlow;
  return parliamentSlotsCarried() && f.slotIndex === index && !benchWarn &&
    (f.stage === 'vote' || f.stage === 'submitting' || f.stage === 'paying');
}

/** WHICH of the viewer's places the next delegate leaves — marked on the zone while the mode stands, never on another player's group. */
export function seatSourceOf(seatColor: Color, viewerColor: Color | undefined, benchSource: BenchSource, benchWarn: boolean): 'lobby' | 'reserve' | undefined {
  if (!parliamentSlotsCarried() || seatColor !== viewerColor || benchWarn) {
    return undefined;
  }
  return benchSource === 'none' ? undefined : benchSource;
}

export type RibbonGroup = {owner: Color | 'neutral', count: number, seqs: ReadonlyArray<number>, hasSeq: (seq: number | undefined) => boolean};

/** A dense ribbon's per-owner stacks (placement order kept inside each). */
export function ribbonGroupsOf(slot: ParliamentSlotVm): Array<RibbonGroup> {
  const groups: Array<{owner: Color | 'neutral', seqs: Array<number>}> = [];
  for (const vote of slot.votes) {
    const group = groups.find((g) => g.owner === vote.owner);
    if (group === undefined) {
      groups.push({owner: vote.owner, seqs: [vote.seq]});
    } else {
      group.seqs.push(vote.seq);
    }
  }
  return groups.map((g) => ({owner: g.owner, count: g.seqs.length, seqs: g.seqs, hasSeq: (seq) => seq !== undefined && g.seqs.includes(seq)}));
}
