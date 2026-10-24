import {expect} from 'chai';
import {advanceQuestCeremony, observeQuestCeremony, questCeremonyState, resetQuestCeremony} from '../../src/client/console/parliament/questCeremony';
import {Color} from '../../src/common/Color';

/**
 * THE CHAIRMAN QUEST CEREMONY (the owner, 2026-10-24): the quest completed by ANOTHER seat is told to every other
 * seat once, in the milestone family's remote strip — seeded on load (never a replay), never to the completer
 * (their own surface is the quest beat), and once per quest (a new government's quest starts clean).
 */
function view(viewer: Color, quest?: {generation: number, source: string, completedBy?: Color}) {
  return {
    thisPlayer: {color: viewer},
    players: [{color: 'red' as Color, name: 'Red'}, {color: 'blue' as Color, name: 'Blue'}, {color: 'green' as Color, name: 'Green'}],
    game: {parliament: quest === undefined ? undefined : {quest}},
  };
}

describe('questCeremony — the chairman quest, told to the table', () => {
  beforeEach(() => resetQuestCeremony());
  after(() => resetQuestCeremony());

  it('the first observation SEEDS: a quest completed before the load is never replayed', () => {
    expect(observeQuestCeremony(view('red', {generation: 3, source: 'starter', completedBy: 'blue'}), 1000)).is.false;
    expect(observeQuestCeremony(view('red', {generation: 3, source: 'starter', completedBy: 'blue'}), 2000)).is.false;
    expect(questCeremonyState.current).is.undefined;
  });

  it('another seat completes it: one strip naming WHO; the same quest never twice', () => {
    observeQuestCeremony(view('red', {generation: 3, source: 'RX05'}), 1000);
    expect(observeQuestCeremony(view('red', {generation: 3, source: 'RX05', completedBy: 'blue'}), 2000)).is.true;
    expect(questCeremonyState.current).deep.include({color: 'blue', actorName: 'Blue', generation: 3});
    expect(observeQuestCeremony(view('red', {generation: 3, source: 'RX05', completedBy: 'blue'}), 3000)).is.false;
    advanceQuestCeremony(3000);
    expect(questCeremonyState.current).is.undefined;
  });

  it('the completer is not told — their own surface is the quest beat', () => {
    observeQuestCeremony(view('red', {generation: 3, source: 'RX05'}), 1000);
    expect(observeQuestCeremony(view('red', {generation: 3, source: 'RX05', completedBy: 'red'}), 2000)).is.false;
    expect(questCeremonyState.current).is.undefined;
  });

  it('the completer is named by its display label, and a new government\'s quest is a new telling', () => {
    observeQuestCeremony(view('red', {generation: 3, source: 'RX05'}), 1000);
    observeQuestCeremony(view('red', {generation: 3, source: 'RX05', completedBy: 'green'}), 2000);
    expect(questCeremonyState.current?.actorName).eq('Green');
    advanceQuestCeremony(2000);
    expect(observeQuestCeremony(view('red', {generation: 4, source: 'RX07', completedBy: 'blue'}), 3000)).is.true;
  });

  it('a stale queued beat is dropped, never replayed late', () => {
    observeQuestCeremony(view('red', {generation: 3, source: 'RX05'}), 1000);
    observeQuestCeremony(view('red', {generation: 3, source: 'RX05', completedBy: 'blue'}), 2000);
    questCeremonyState.queue.push({color: 'green', actorName: 'Бот', generation: 4, at: 2000});
    advanceQuestCeremony(2000 + 60_000);
    expect(questCeremonyState.current).is.undefined;
  });
});
