import {expect} from 'chai';
import {buildConsoleMaItems, consoleMaFocusContext, consoleMaPressNotice, ConsoleMaSource, stepGrid} from '@/client/components/console/consoleMaModel';
import type {Color} from '@/common/Color';

/**
 * P26: the Milestones/Awards premium screen view-model. The whole state
 * matrix (ready / short / blocked / taken / slots-exhausted / award
 * leadership) is pure, so the "no unavailability spam" contract — blockers
 * are CONCRETE and focused-only, a short milestone explains itself via the
 * threshold gap — is guarded here without a DOM.
 */
describe('consoleMaModel (P26)', () => {
  const me: Color = 'red';
  const rival: Color = 'blue';

  const opts = (over: Partial<Parameters<typeof buildConsoleMaItems>[2]> = {}) => ({
    myColor: me,
    myTurn: true,
    awaitingInput: true,
    myMegacredits: 20,
    availableNow: new Set<string>(),
    describe: () => 'rule text',
    maxSlots: 3,
    nextCost: 8,
    ...over,
  });

  const milestone = (over: Partial<ConsoleMaSource> = {}): ConsoleMaSource => ({
    name: 'Mayor',
    playerName: undefined,
    color: undefined,
    scores: [{color: me, score: 1, claimable: false}, {color: rival, score: 2, claimable: false}],
    threshold: 3,
    ...over,
  });

  it('milestone: available now → CTA on, no blocker, ready context', () => {
    const [it] = buildConsoleMaItems('milestones', [milestone({
      scores: [{color: me, score: 3, claimable: true}, {color: rival, score: 1, claimable: false}],
    })], opts({availableNow: new Set(['Mayor'])}));
    expect(it.available).to.eq(true);
    expect(it.myReady).to.eq(true);
    expect(it.blocker).to.eq('');
    expect(it.cost).to.eq(8);
    expect(consoleMaFocusContext(it)).to.deep.eq({tone: 'ready', key: 'Threshold reached — claim now'});
  });

  it('milestone short of the threshold: NO blocker — the gap context explains it', () => {
    const [it] = buildConsoleMaItems('milestones', [milestone()], opts());
    expect(it.available).to.eq(false);
    expect(it.myReady).to.eq(false);
    expect(it.blocker).to.eq('');
    expect(consoleMaFocusContext(it)).to.deep.eq({tone: 'gap', gap: 2});
    expect(consoleMaPressNotice(it)).to.eq('Threshold not reached yet');
  });

  it('milestone ready but not offered: turn → money → mid-action, in that order', () => {
    const ready = milestone({scores: [{color: me, score: 3, claimable: true}]});
    const [turn] = buildConsoleMaItems('milestones', [ready], opts({myTurn: false, awaitingInput: false}));
    expect(turn.blocker).to.eq('Not your turn to take any actions');
    const [busy] = buildConsoleMaItems('milestones', [ready], opts({myTurn: false, awaitingInput: true}));
    expect(busy.blocker).to.eq('Finish your current action first');
    const [money] = buildConsoleMaItems('milestones', [ready], opts({myMegacredits: 5}));
    expect(money.blocker).to.eq('Not enough M€');
    const [midAction] = buildConsoleMaItems('milestones', [ready], opts());
    expect(midAction.blocker).to.eq('Finish your current action first');
    expect(consoleMaFocusContext(midAction)).to.deep.eq({tone: 'blocked', key: 'Finish your current action first'});
  });

  it('taken item: owner carried, no cost, owner context, honest press notice', () => {
    const [it] = buildConsoleMaItems('milestones', [milestone({playerName: 'Ann', color: rival, scores: []})], opts());
    expect(it.takenBy).to.deep.eq({color: rival, name: 'Ann'});
    expect(it.cost).to.eq(undefined);
    expect(it.blocker).to.eq('');
    expect(consoleMaFocusContext(it)).to.deep.eq({tone: 'owner', kind: 'milestone', color: rival, name: 'Ann'});
    expect(consoleMaPressNotice(it)).to.eq('Already claimed');
  });

  it('slot race closed (3/3 to others): remaining items lose the cost + name the blocker', () => {
    const taken = (n: string) => milestone({name: n, playerName: 'X', color: rival, scores: []});
    const items = buildConsoleMaItems('milestones',
      [taken('A'), taken('B'), taken('C'), milestone({name: 'Open', scores: []})], opts());
    const open = items[3];
    expect(open.slotsExhausted).to.eq(true);
    expect(open.cost).to.eq(undefined);
    expect(open.blocker).to.eq('All slots are taken');
  });

  it('award: leadership is derived vs ALL players; funded award keeps the live race', () => {
    const award: ConsoleMaSource = {
      name: 'Banker', playerName: 'Bob', color: rival,
      scores: [{color: me, score: 5}, {color: rival, score: 3}],
    };
    const [it] = buildConsoleMaItems('awards', [award], opts({nextCost: 14}));
    expect(it.myLead).to.eq(true);
    expect(it.leaderScore).to.eq(5);
    expect(it.takenBy?.name).to.eq('Bob');
    expect(consoleMaPressNotice(it)).to.eq('Already funded');
  });

  it('award available: fund context; award blocked by money names it', () => {
    const award: ConsoleMaSource = {
      name: 'Banker', playerName: undefined, color: undefined,
      scores: [{color: me, score: 1}, {color: rival, score: 4}],
    };
    const [avail] = buildConsoleMaItems('awards', [award], opts({availableNow: new Set(['Banker']), nextCost: 14}));
    expect(consoleMaFocusContext(avail)).to.deep.eq({tone: 'ready', key: 'Ready to fund now'});
    const [poor] = buildConsoleMaItems('awards', [award], opts({myMegacredits: 3, nextCost: 14}));
    expect(poor.blocker).to.eq('Not enough M€');
    expect(poor.myLead).to.eq(false);
  });

  it('server per-game description wins over the manifest fallback', () => {
    const [server] = buildConsoleMaItems('milestones', [milestone({description: 'per-game'})], opts());
    expect(server.description).to.eq('per-game');
    const [manifest] = buildConsoleMaItems('milestones', [milestone()], opts());
    expect(manifest.description).to.eq('rule text');
  });

  describe('stepGrid (2-column dashboard nav)', () => {
    it('moves within a full 6-item grid', () => {
      expect(stepGrid(0, 'right', 6, 2)).to.eq(1);
      expect(stepGrid(1, 'left', 6, 2)).to.eq(0);
      expect(stepGrid(1, 'down', 6, 2)).to.eq(3);
      expect(stepGrid(4, 'up', 6, 2)).to.eq(2);
    });

    it('clamps at the edges instead of wrapping', () => {
      expect(stepGrid(1, 'right', 6, 2)).to.eq(1);
      expect(stepGrid(0, 'left', 6, 2)).to.eq(0);
      expect(stepGrid(0, 'up', 6, 2)).to.eq(0);
      expect(stepGrid(4, 'down', 6, 2)).to.eq(4);
    });

    it('odd list: down from the right column lands on the spanning last card', () => {
      expect(stepGrid(3, 'down', 5, 2)).to.eq(4);
      expect(stepGrid(2, 'down', 5, 2)).to.eq(4);
      expect(stepGrid(4, 'down', 5, 2)).to.eq(4);
      expect(stepGrid(4, 'up', 5, 2)).to.eq(2);
    });

    it('degenerate inputs stay in range', () => {
      expect(stepGrid(0, 'down', 0, 2)).to.eq(0);
      expect(stepGrid(9, 'left', 3, 2)).to.eq(2);
    });
  });
});
