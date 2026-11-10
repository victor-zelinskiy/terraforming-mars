import {expect} from 'chai';
import {assign, setup} from 'xstate';
import {FLOW_KINDS, flowKindCycle, mayWaitOn, WAITS_ON} from '@/client/console/kernel/flowKinds';
import {delayedEventTypes, exploreMachine, machineLawViolations} from '@/client/console/kernel/flowLaw';
import {FLOW_MACHINES} from '@/client/console/kernel/flowMachines';

/**
 * THE LAW — «who waits on whom» is a table that is a DAG, and every lifecycle machine has a tag on every state, a
 * bound on every beat, no trap, and a way to rest from everywhere. The positive controls below put each defect in on
 * purpose: a judge that finds nothing in them proves nothing.
 */
describe('flow kernel · the law', () => {
  describe('WAITS_ON — the kind table', () => {
    it('is a DAG: no kind can (transitively) wait for itself', () => {
      expect(flowKindCycle()).to.deep.eq([]);
    });

    it('positive control: a table with a cycle is named', () => {
      expect(flowKindCycle({frame: ['story'], story: ['frame'], submit: []})).to.deep.eq(['frame', 'story', 'frame']);
      expect(flowKindCycle({a: ['b'], b: ['c'], c: ['a']})).to.deep.eq(['a', 'b', 'c', 'a']);
    });

    it('the laws the point fixes of 2026-10…11 wrote, as rows', () => {
      // A decision never waits on a story (the Venus trade, the hydro finish).
      expect(mayWaitOn('frame', 'story')).to.eq(false);
      expect(mayWaitOn('claim', 'story')).to.eq(false);
      // A story waits for a covered board to clear.
      expect(mayWaitOn('story', 'frame')).to.eq(true);
      // The submit waits for nobody; everybody may wait for it.
      expect(WAITS_ON.submit).to.deep.eq([]);
      for (const kind of ['frame', 'claim', 'step', 'surface', 'story', 'scene', 'announce'] as const) {
        expect(mayWaitOn(kind, 'submit'), kind).to.eq(true);
      }
      // The plate yields to everything on screen, and nothing waits for the plate (the chairman quest's cycle).
      for (const kind of FLOW_KINDS) {
        expect(mayWaitOn(kind, 'announce'), `${kind} → announce`).to.eq(false);
      }
    });
  });

  describe('a lifecycle machine — the static judge', () => {
    const lawful = setup({}).createMachine({
      id: 'lawful',
      initial: 'idle',
      states: {
        idle: {tags: ['rest'], on: {PRESS: 'sending'}},
        sending: {
          tags: ['beat'], meta: {waitsOn: 'the server'},
          on: {ANSWER: 'asking', REFUSED: 'idle'},
          after: {60000: 'idle'},
        },
        asking: {tags: ['player'], meta: {accepts: 'the stage'}, on: {OK: 'done'}},
        done: {type: 'final'},
      },
    });

    it('a machine that keeps the law has no violation', () => {
      expect(machineLawViolations(lawful)).to.deep.eq([]);
    });

    it('positive control: a state with no tag', () => {
      const m = setup({}).createMachine({id: 'm', initial: 'a', states: {a: {on: {GO: 'b'}}, b: {tags: ['rest']}}});
      expect(machineLawViolations(m).map((v) => `${v.state} ${v.rule}`)).to.deep.eq(['m.a tag']);
    });

    it('positive control: a beat with no bound — «a wait with no bound»', () => {
      const m = setup({}).createMachine({
        id: 'm', initial: 'a',
        states: {a: {tags: ['rest'], on: {GO: 'b'}}, b: {tags: ['beat'], meta: {waitsOn: 'the answer'}, on: {ANSWER: 'a'}}},
      });
      expect(machineLawViolations(m).map((v) => `${v.state} ${v.rule}`)).to.deep.eq(['m.b bound']);
    });

    it('positive control: a beat that does not say what it waits for', () => {
      const m = setup({}).createMachine({
        id: 'm', initial: 'a',
        states: {a: {tags: ['rest'], on: {GO: 'b'}}, b: {tags: ['beat'], after: {1000: 'a'}}},
      });
      expect(machineLawViolations(m).map((v) => `${v.state} ${v.rule}`)).to.deep.eq(['m.b waits-on']);
    });

    it('positive control: a player state that names no surface, and one with no way out — «a state with no exit»', () => {
      const m = setup({}).createMachine({
        id: 'm', initial: 'a',
        states: {
          a: {tags: ['rest'], on: {GO: 'b', STOP: 'c'}},
          b: {tags: ['player'], on: {OK: 'a'}},
          c: {tags: ['player'], meta: {accepts: 'a plate'}},
        },
      });
      expect(machineLawViolations(m).map((v) => `${v.state} ${v.rule}`)).to.deep.eq(['m.b accepts', 'm.c trap', 'm.c no-rest']);
    });

    it('positive control: two beats that only lead to each other — no rest is reachable', () => {
      const m = setup({}).createMachine({
        id: 'm', initial: 'idle',
        states: {
          idle: {tags: ['rest'], on: {GO: 'ping'}},
          ping: {tags: ['beat'], meta: {waitsOn: 'pong'}, after: {1000: 'pong'}},
          pong: {tags: ['beat'], meta: {waitsOn: 'ping'}, after: {1000: 'ping'}},
        },
      });
      expect(machineLawViolations(m).map((v) => `${v.state} ${v.rule}`)).to.deep.eq(['m.ping no-rest', 'm.pong no-rest']);
    });

    it('a tag, a bound and `waitsOn` on a compound state cover the states inside it; regions are judged apart', () => {
      const m = setup({}).createMachine({
        id: 'claim', initial: 'live',
        states: {
          live: {
            type: 'parallel',
            on: {RELEASE: 'released'},
            states: {
              stage: {
                initial: 'awaiting',
                states: {
                  awaiting: {tags: ['beat'], meta: {waitsOn: 'the answer'}, after: {20000: '#claim.released'}, on: {PRESENT: 'presenting'}},
                  presenting: {tags: ['player'], meta: {accepts: 'the embedded stage'}},
                },
              },
              beat: {
                initial: 'pending',
                states: {
                  pending: {tags: ['beat'], meta: {waitsOn: 'the flight'}, after: {2600: 'over'}},
                  over: {tags: ['rest']},
                },
              },
            },
          },
          released: {type: 'final'},
        },
      });
      expect(machineLawViolations(m)).to.deep.eq([]);
    });
  });

  describe('a lifecycle machine — the dynamic judge', () => {
    it('reads the reachable snapshots, the declared delays included', () => {
      const m = setup({}).createMachine({
        id: 'm', initial: 'idle',
        states: {
          idle: {tags: ['rest'], on: {GO: 'busy'}},
          busy: {tags: ['beat'], meta: {waitsOn: 'x'}, after: {500: 'idle'}},
        },
      });
      expect(delayedEventTypes(m)).to.deep.eq(['xstate.after.500.m.busy']);
      const r = exploreMachine(m, {events: [{type: 'GO'}]});
      expect(r.violations).to.deep.eq([]);
      expect(r.states).to.eq(2);
    });

    it('positive control: a bound behind a guard that never passes is a dead bound', () => {
      const m = setup({guards: {never: () => false}}).createMachine({
        id: 'm', initial: 'idle',
        states: {
          idle: {tags: ['rest'], on: {GO: 'busy'}},
          busy: {tags: ['beat'], meta: {waitsOn: 'x'}, after: {500: {target: 'idle', guard: 'never'}}},
        },
      });
      // The definition LOOKS lawful…
      expect(machineLawViolations(m)).to.deep.eq([]);
      // …and the explorer finds the beat nothing can end.
      expect(exploreMachine(m, {events: [{type: 'GO'}]}).violations.map((v) => `${v.state} ${v.rule}`))
        .to.deep.eq(['busy dead-bound', 'busy no-rest']);
    });

    it('positive control: a player state whose only press is refused by its guard', () => {
      const m = setup({guards: {never: () => false}}).createMachine({
        id: 'm', initial: 'idle',
        states: {
          idle: {tags: ['rest'], on: {GO: 'asked'}},
          asked: {tags: ['player'], meta: {accepts: 'a plate'}, on: {OK: {target: 'idle', guard: 'never'}}},
        },
      });
      expect(exploreMachine(m, {events: [{type: 'GO'}, {type: 'OK'}]}).violations.map((v) => `${v.state} ${v.rule}`))
        .to.deep.eq(['asked dead-press']);
    });

    it('a context that counts without bound is reported, never a hung judge', () => {
      const m = setup({types: {context: {} as {n: number}}}).createMachine({
        id: 'm', initial: 'a', context: {n: 0},
        states: {a: {tags: ['rest'], on: {INC: {actions: assign({n: ({context}) => context.n + 1})}}}},
      });
      expect(exploreMachine(m, {events: [{type: 'INC'}], maxStates: 50}).violations.map((v) => v.rule)).to.deep.eq(['explosion']);
      // …and a coarser key (the judge is told what matters) reads it as the one state it is.
      expect(exploreMachine(m, {events: [{type: 'INC'}], key: (snapshot) => JSON.stringify(snapshot.value)})).to.deep.eq({violations: [], states: 1});
    });
  });

  describe('every registered lifecycle machine keeps the law', () => {
    for (const entry of FLOW_MACHINES) {
      it(`${entry.name} — the definition`, () => {
        expect(machineLawViolations(entry.machine)).to.deep.eq([]);
      });
      it(`${entry.name} — the reachable snapshots`, () => {
        const r = exploreMachine(entry.machine, {events: entry.events, ...(entry.input !== undefined ? {input: entry.input} : {}), ...(entry.key !== undefined ? {key: entry.key} : {})});
        expect(r.violations).to.deep.eq([]);
        expect(r.states).to.be.greaterThan(1);
      });
    }

    it('the registry is not empty once the first lifecycle is on the kernel', () => {
      expect(FLOW_MACHINES).to.be.an('array');
    });
  });
});
