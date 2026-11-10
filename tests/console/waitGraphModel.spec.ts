import {expect} from 'chai';
import {
  confirmWaitFindings, initialWaitGraphConfirm, judgeWaitGraph, WAIT_GRAPH_CONFIRM_TICKS, WAIT_STILL_MOTION_MS, waitCycles, WaitNode, WaitWorld, yieldingMember,
} from '@/client/console/waitGraph/waitGraphModel';

/*
 * THE WAIT GRAPH's pure half (docs/claude/console/wait-graph.md) — judged on the FIELD SHAPES as positive controls:
 * the chairman-quest mutual wait of 2026-11-07 (pe81fc58), the rally whose run was reset under it (gc4cb8d130e52), the
 * announce plate pending behind a hidden board — each must be SEEN, structurally, the tick it stands.
 */
const world = (over: Partial<WaitWorld> = {}): WaitWorld => ({now: 10_000, accepting: true, requestInFlight: false, serverOwes: false, ...over});
const node = (id: string, family: WaitNode['family'], targets: WaitNode['targets'], over: Partial<WaitNode> = {}): WaitNode =>
  ({id, family, owner: 'test', since: 1_000, targets, ...over});

describe('waitGraphModel', () => {
  it('THE CHAIRMAN-QUEST FIELD LOCK is a cycle — the conclusion waits for the gate, the gate for its plate, the plate for the frame to leave', () => {
    const nodes = [
      node('conclusion:parliament', 'conclusion', [{kind: 'node', id: 'question:chairmanQuest#509'}], {recovery: 'question-door'}),
      node('question:chairmanQuest#509', 'question', [{kind: 'node', id: 'announce:task:chairmanQuest#509'}]),
      node('announce:task:chairmanQuest#509', 'announce', [{kind: 'node', id: 'conclusion:parliament'}], {since: 2_000, detail: 'plate hidden: not board home'}),
    ];
    const findings = judgeWaitGraph(nodes, world());
    const cycle = findings.find((f) => f.kind === 'cycle');
    expect(cycle?.members).to.deep.eq(['announce:task:chairmanQuest#509', 'conclusion:parliament', 'question:chairmanQuest#509']);
    expect(cycle?.yields, 'the plate the player never saw yields first').eq('announce:task:chairmanQuest#509');
    expect(cycle?.ageMs).eq(9_000);
  });

  it('THE RALLY RESET — the frame\'s beat waits on a run that was reset under it: dangling', () => {
    const nodes = [node('surface:parliament:executing', 'surface', [{kind: 'node', id: 'flow:rally#43'}])];
    const findings = judgeWaitGraph(nodes, world());
    expect(findings.map((f) => f.kind)).to.deep.eq(['dangling']);
    expect(findings[0].why).to.contain('flow:rally#43');
  });

  it('a press owed with NOTHING accepting is a dead end; with a surface accepting it is the player\'s honest time', () => {
    const plate = [node('announce:task:handSelect#7', 'announce', [{kind: 'player', what: 'A on the plate'}])];
    expect(judgeWaitGraph(plate, world({accepting: false})).map((f) => f.kind)).to.deep.eq(['dead-end']);
    expect(judgeWaitGraph(plate, world({accepting: true})), 'reading is not a stall').to.deep.eq([]);
  });

  it('a press owed with nothing accepting is NOT a dead end while something moves on screen — the arbiter\'s own definition of a stall', () => {
    const q = [node('question:cardSelect#252', 'question', [{kind: 'player', what: 'answer the question'}])];
    expect(judgeWaitGraph(q, world({accepting: false, motionInFlight: true})), 'a hand-over / a scene in flight').to.deep.eq([]);
    expect(judgeWaitGraph(q, world({accepting: false, motionInFlight: false})).map((f) => f.kind)).to.deep.eq(['dead-end']);
  });

  it('a VISIBLE motion with the page standing still is a dead end — a blocking hold claiming a story while nothing plays', () => {
    const hold = [node('hold:rail-reward', 'hold', [{kind: 'motion', what: 'rail-reward', witnessed: true}], {boundMs: 35_000, recovery: 'hold-expire'})];
    // The wait is 9 s old (since 1 000, now 10 000): the page still as long as the threshold → it cannot come.
    expect(judgeWaitGraph(hold, world({stillMs: WAIT_STILL_MOTION_MS})).map((f) => f.kind)).to.deep.eq(['dead-end']);
    expect(judgeWaitGraph(hold, world({stillMs: WAIT_STILL_MOTION_MS - 1})), 'the page moved recently').to.deep.eq([]);
    // A wait YOUNGER than the threshold is not judged by an old stillness (a hold just begun on an idle page).
    expect(judgeWaitGraph(hold, world({now: 1_000 + WAIT_STILL_MOTION_MS - 1, stillMs: 60_000}))).to.deep.eq([]);
    // An unwitnessed motion (a notification-only hold, a story) stays its own clock.
    const quiet = [node('hold:feed', 'hold', [{kind: 'motion', what: 'feed'}], {boundMs: 35_000})];
    expect(judgeWaitGraph(quiet, world({stillMs: 60_000}))).to.deep.eq([]);
    // A hold that declares it waits for the PLAYER is the player's time while a surface accepts.
    const reading = [node('hold:reveal', 'hold', [{kind: 'player', what: 'reveal'}, {kind: 'motion', what: 'reveal', witnessed: true}], {recovery: 'hold-expire'})];
    expect(judgeWaitGraph(reading, world({stillMs: 60_000, accepting: true}))).to.deep.eq([]);
    // …and one that waits for the SERVER plays on after the answer came: dead only when the server cannot come AND the
    // page stood still (the hydro marker's lock, cut at 3 s by a server-only target in the armed slice).
    const lock = [node('hold:hydro-marker', 'hold', [{kind: 'server', what: 'hydro-marker'}, {kind: 'motion', what: 'hydro-marker', witnessed: true}], {recovery: 'hold-expire'})];
    expect(judgeWaitGraph(lock, world({stillMs: 1_000})), 'the answer came, the lock still plays').to.deep.eq([]);
    expect(judgeWaitGraph(lock, world({requestInFlight: true, stillMs: 60_000})), 'the answer is on the wire').to.deep.eq([]);
    expect(judgeWaitGraph(lock, world({stillMs: WAIT_STILL_MOTION_MS})).map((f) => f.kind)).to.deep.eq(['dead-end']);
  });

  it('an answer with nothing on the wire and nothing owed is a dead end; a request in flight or a server debt is honest', () => {
    const submit = [node('flow:start-first-act', 'flow', [{kind: 'server', what: 'the first action answered'}], {boundMs: 20_000})];
    expect(judgeWaitGraph(submit, world()).map((f) => f.kind)).to.deep.eq(['dead-end']);
    expect(judgeWaitGraph(submit, world({requestInFlight: true}))).to.deep.eq([]);
    expect(judgeWaitGraph(submit, world({serverOwes: true}))).to.deep.eq([]);
  });

  it('a declared bound is kept or the node is overdue; no bound and no door (but the player) is unbounded', () => {
    const nodes = [
      node('hold:card-deal', 'hold', [{kind: 'motion', what: 'the deal'}], {boundMs: 6_000}),
      node('hold:fresh', 'hold', [{kind: 'motion', what: 'a flight'}], {boundMs: 6_000, since: 9_000}),
      node('flow:promised-walk', 'flow', [{kind: 'server', what: 'the record'}]),
      node('surface:hand', 'surface', [{kind: 'player', what: 'a card picked'}]),
    ];
    const kinds = judgeWaitGraph(nodes, world({serverOwes: true})).map((f) => `${f.kind}:${f.members[0]}`);
    expect(kinds).to.deep.eq(['overdue:hold:card-deal', 'unbounded:flow:promised-walk']);
  });

  it('UNBOUNDED is judged on external ends only — a question held by a plate is as bounded as the plate (the first shadow run\'s noise)', () => {
    const nodes = [
      node('question:cardSelect#3', 'question', [{kind: 'node', id: 'announce:task#3'}]),
      node('announce:task#3', 'announce', [{kind: 'player', what: 'A on the plate'}]),
      node('surface:parliament', 'surface', [{kind: 'node', id: 'question:cardSelect#3'}]),
    ];
    expect(judgeWaitGraph(nodes, world())).to.deep.eq([]);
  });

  it('cycles: two independent ones, a self-wait, and the members of a cycle are not judged again as dead ends', () => {
    const nodes = [
      node('a', 'flow', [{kind: 'node', id: 'b'}]), node('b', 'hold', [{kind: 'node', id: 'a'}, {kind: 'player', what: 'x'}]),
      node('c', 'claim', [{kind: 'node', id: 'c'}]),
      node('d', 'surface', [{kind: 'node', id: 'a'}]),
    ];
    expect(waitCycles(nodes)).to.deep.eq([['a', 'b'], ['c']]);
    const findings = judgeWaitGraph(nodes, world({accepting: false}));
    expect(findings.filter((f) => f.kind === 'cycle')).to.have.length(2);
    expect(findings.some((f) => f.kind === 'dead-end' && f.members[0] === 'b'), 'b is in a cycle').eq(false);
    expect(yieldingMember(nodes, ['a', 'b']), 'the hold yields before the flow').eq('b');
  });

  it('a finding is CONFIRMED once, on its third consecutive tick; a one-frame cycle is never reported', () => {
    const nodes = [node('a', 'flow', [{kind: 'node', id: 'b'}]), node('b', 'flow', [{kind: 'node', id: 'a'}])];
    let state = initialWaitGraphConfirm();
    const reported: Array<number> = [];
    for (let tick = 1; tick <= WAIT_GRAPH_CONFIRM_TICKS + 2; tick++) {
      const r = confirmWaitFindings(state, judgeWaitGraph(nodes, world()));
      state = r.state;
      if (r.confirmed.length > 0) {
        reported.push(tick);
      }
    }
    expect(reported).to.deep.eq([WAIT_GRAPH_CONFIRM_TICKS]);
    // A flicker: present, gone, present — the streak restarts.
    state = initialWaitGraphConfirm();
    state = confirmWaitFindings(state, judgeWaitGraph(nodes, world())).state;
    state = confirmWaitFindings(state, []).state;
    expect(confirmWaitFindings(state, judgeWaitGraph(nodes, world())).confirmed).to.deep.eq([]);
  });
});
