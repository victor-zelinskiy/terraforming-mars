import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel} from '@/common/models/ParliamentModel';
import {parliamentFlow, setParliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {resetRivalVotes, rivalVotes, seedRivalVotes, settleRivalVotes} from '@/client/console/parliament/parliamentRivalVotes';

/**
 * ANOTHER SEAT'S DELEGATE ARRIVES — the SEED (the pure half): which cubes of a
 * response fly, from which place, and when nothing flies at all. The flight
 * itself is the sitting's own `flyCube`; the e2e watches it land.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const GREEN = 'green' as Color;

function seat(color: Color, over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {color, participates: true, enactment: color !== RED, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: [], partyActionUses: {}, resolutionActionUses: 0, ...over};
}

function slot(instance: string, votes: Array<{owner: Color | 'neutral', seq: number}>): ParliamentSlotModel {
  return {instance, resolution: instance, party: PartyName.GREENS, votes, totalVotes: votes.length, isWinning: false, tiePriority: 1, viewerVotes: 0};
}

function model(slots: Array<ParliamentSlotModel>, players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots, rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'politics', ...over};
}

function view(parliament: ParliamentModel, id = 'p-blue'): PlayerViewModel {
  return {id, thisPlayer: {color: BLUE}, players: [], game: {parliament}} as unknown as PlayerViewModel;
}

describe('parliamentRivalVotes — the seed of a rival delegate\'s arrival', () => {
  let root: HTMLElement;
  beforeEach(() => {
    resetRivalVotes();
    resetParliamentHolds();
    root = document.createElement('div');
    setParliamentRootEl(root);
    parliamentFlow.stage = 'browse';
  });
  after(() => {
    resetRivalVotes();
    resetParliamentHolds();
    setParliamentRootEl(undefined);
    parliamentFlow.stage = 'browse';
  });

  it('a rival\'s NEW cube is queued, hidden on the ribbon and kept painted at its source — the lobby when the free delegate went, else the reserve', () => {
    const before = view(model([slot('A', [])], [seat(BLUE), seat(RED)]));
    const after = view(model([slot('A', [{owner: RED, seq: 7}, {owner: RED, seq: 8}])], [seat(BLUE), seat(RED, {lobby: false, reserve: 5})]));
    seedRivalVotes(before, after);
    expect(rivalVotes.queue).deep.eq([
      {kind: 'vote', id: 'A#7', instance: 'A', seq: 7, owner: RED, source: 'lobby'},
      {kind: 'vote', id: 'A#8', instance: 'A', seq: 8, owner: RED, source: 'reserve'},
    ]);
    expect(parliamentHolds.hiddenCubes.has('A#7')).is.true;
    expect(parliamentHolds.hiddenCubes.has('A#8')).is.true;
    expect(rivalVotes.sources.get(RED)).deep.eq({lobby: 1, reserve: 1});
    expect(rivalVotes.seenSeq).eq(8);
  });

  it('the viewer\'s own cube and a neutral cube never fly; a cube already seen never flies twice', () => {
    const before = view(model([slot('A', [{owner: RED, seq: 3}])], [seat(BLUE), seat(RED)]));
    const after = view(model([slot('A', [{owner: RED, seq: 3}, {owner: BLUE, seq: 4}, {owner: 'neutral', seq: 5}])], [seat(BLUE, {lobby: false}), seat(RED)]));
    seedRivalVotes(before, after);
    expect(rivalVotes.queue).deep.eq([]);
    expect(parliamentHolds.hiddenCubes.size).eq(0);
    // …and an echo of the same view queues nothing either.
    seedRivalVotes(after, after);
    expect(rivalVotes.queue).deep.eq([]);
  });

  it('a FIRST reading of the table flies nothing: no earlier view, another seat\'s id, a sitting that just closed', () => {
    const table = model([slot('A', [{owner: RED, seq: 9}])], [seat(BLUE), seat(RED, {lobby: false})]);
    seedRivalVotes(undefined, view(table));
    expect(rivalVotes.queue).deep.eq([]);
    expect(rivalVotes.seenSeq).eq(9);
    const other = view(model([slot('A', [])], [seat(BLUE), seat(RED)]), 'p-other');
    seedRivalVotes(other, view(table));
    expect(rivalVotes.queue).deep.eq([]);
    const inSitting = view(model([slot('A', [])], [seat(BLUE), seat(RED)], {phase: {generation: 1, final: false, step: 'adjourn'}}));
    seedRivalVotes(inSitting, view(table));
    expect(rivalVotes.queue, 'the sitting\'s own beats owned every cube — the refreshed table is simply read').deep.eq([]);
  });

  it('with the section NOT mounted nothing is queued and nothing is hidden — the table is simply as it is on the next mount', () => {
    setParliamentRootEl(undefined);
    const before = view(model([slot('A', [])], [seat(BLUE), seat(RED)]));
    const after = view(model([slot('A', [{owner: RED, seq: 2}])], [seat(BLUE), seat(RED, {lobby: false})]));
    seedRivalVotes(before, after);
    expect(rivalVotes.queue).deep.eq([]);
    expect(parliamentHolds.hiddenCubes.size).eq(0);
    expect(rivalVotes.arrived.size, 'no arrival mark either: nobody watched it arrive').eq(0);
    expect(rivalVotes.seenSeq).eq(2);
  });

  it('during a SITTING the response\'s cubes belong to the sitting\'s own beats: nothing is queued', () => {
    parliamentFlow.stage = 'sitting';
    const before = view(model([slot('A', [])], [seat(BLUE), seat(RED)]));
    const after = view(model([slot('A', [{owner: RED, seq: 2}])], [seat(BLUE), seat(RED, {lobby: false})], {phase: {generation: 1, final: false, step: 'assembly'}}));
    seedRivalVotes(before, after);
    expect(rivalVotes.queue).deep.eq([]);
  });

  it('two humans in one response: each cube leaves ITS seat\'s place, in placement order', () => {
    const before = view(model([slot('A', []), slot('B', [])], [seat(BLUE), seat(RED), seat(GREEN)]));
    const after = view(model([slot('A', [{owner: GREEN, seq: 12}]), slot('B', [{owner: RED, seq: 11}])], [seat(BLUE), seat(RED, {lobby: false}), seat(GREEN, {lobby: false})]));
    seedRivalVotes(before, after);
    expect(rivalVotes.queue.map((e) => (e.kind === 'vote' ? `${e.owner}:${e.instance}:${e.seq}:${e.source}` : e.id))).deep.eq(['red:B:11:lobby', 'green:A:12:lobby']);
  });

  describe('a RIVAL\'S CARD rallies neutral delegates (TR31) — the record, by its serial', () => {
    const rally = (seq: number) => ({
      seq, player: RED, winnerBefore: 'B', votes: [{instance: 'A', resolution: 'A', party: PartyName.REDS, seq: 21, votes: 1, winnerAfter: 'A'}],
      missing: [], votesCut: [],
      support: [{party: PartyName.REDS, current: 1, gained: 1, resulting: 2, printed: 1}, {party: PartyName.MARS, current: 3, gained: 0, resulting: 3, printed: 1, limit: 'area' as const}],
      counted: {votes: [{instance: 'A', seqs: [21]}], support: [{party: PartyName.MARS, count: 3}, {party: PartyName.REDS, count: 2}]},
      inUse: {before: 4, after: 6}, megacredits: 6, generation: 2,
    });

    it('its neutral vote flies from the POOL to the ribbon, its support cube from the pool to the plaque\'s next socket — the pool and the plaque held until each has moved', () => {
      const before = view(model([slot('A', []), slot('B', [{owner: RED, seq: 20}])], [seat(BLUE), seat(RED)], {popularSupport: {[PartyName.REDS]: 1, [PartyName.MARS]: 3}}));
      const after = view(model([slot('A', [{owner: 'neutral', seq: 21}]), slot('B', [{owner: RED, seq: 20}])], [seat(BLUE), seat(RED)],
        {popularSupport: {[PartyName.REDS]: 2, [PartyName.MARS]: 3}, lastRally: rally(7)} as never));
      seedRivalVotes(before, after);
      expect(rivalVotes.queue).deep.eq([
        {kind: 'vote', id: 'A#21', instance: 'A', seq: 21, owner: 'neutral', source: 'pool'},
        {kind: 'support', id: `support:${PartyName.REDS}#2#7`, party: PartyName.REDS, place: 2, owner: 'neutral', source: 'pool'},
      ]);
      expect(parliamentHolds.hiddenCubes.has('A#21'), 'the ribbon cube is hidden until its touchdown').is.true;
      expect(rivalVotes.poolHeld, 'the pool still paints both cubes').eq(2);
      expect(rivalVotes.supportIncoming.get(PartyName.REDS), 'the plaque does not draw its new cube yet').eq(1);
      expect(rivalVotes.supportIncoming.get(PartyName.MARS), 'an area that took nothing holds nothing').is.undefined;
      expect(rivalVotes.rallySeenSeq).eq(7);
      // An echo of the same view queues nothing twice; the viewer's OWN rally is never queued here (the hand plays it).
      seedRivalVotes(after, after);
      expect(rivalVotes.queue).has.lengthOf(2);
      settleRivalVotes();
      const own = view(model([slot('A', [{owner: 'neutral', seq: 22}])], [seat(BLUE), seat(RED)], {lastRally: {...rally(8), player: BLUE}} as never));
      seedRivalVotes(after, own);
      expect(rivalVotes.queue).deep.eq([]);
    });

    it('a first reading of the table remembers the record\'s serial without flying it; settling releases the pool and the plaque', () => {
      const table = model([slot('A', [{owner: 'neutral', seq: 21}])], [seat(BLUE), seat(RED)], {lastRally: rally(7)} as never);
      seedRivalVotes(undefined, view(table));
      expect(rivalVotes.queue).deep.eq([]);
      expect(rivalVotes.rallySeenSeq).eq(7);
      const before = view(model([slot('A', [])], [seat(BLUE), seat(RED)]));
      const after = view(model([slot('A', [{owner: 'neutral', seq: 21}])], [seat(BLUE), seat(RED)], {popularSupport: {[PartyName.REDS]: 2}, lastRally: rally(9)} as never));
      seedRivalVotes(before, after);
      expect(rivalVotes.poolHeld).eq(2);
      settleRivalVotes();
      expect(rivalVotes.poolHeld).eq(0);
      expect(rivalVotes.supportIncoming.size).eq(0);
      expect(parliamentHolds.hiddenCubes.has('A#21')).is.false;
    });
  });

  it('settling lets every queued cube be where the model says (the section left, the hold expired)', () => {
    const before = view(model([slot('A', [])], [seat(BLUE), seat(RED)]));
    const after = view(model([slot('A', [{owner: RED, seq: 7}])], [seat(BLUE), seat(RED, {lobby: false})]));
    seedRivalVotes(before, after);
    expect(parliamentHolds.hiddenCubes.has('A#7')).is.true;
    settleRivalVotes();
    expect(rivalVotes.queue).deep.eq([]);
    expect(rivalVotes.flying).is.undefined;
    expect(rivalVotes.sources.size).eq(0);
    expect(parliamentHolds.hiddenCubes.has('A#7')).is.false;
  });
});
