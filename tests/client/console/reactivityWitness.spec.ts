import {expect} from 'chai';
import {computed, reactive} from 'vue';
import {
  auditReactivity, reactivePredicate, reactivePredicateLabels, recentReactivityLatches, resetReactivityWitnessForTest,
} from '@/client/components/presentation/reactivityWitness';
import {
  animationHoldCount, registerAnimationHoldSupplier, unregisterAnimationHoldSupplier,
} from '@/client/components/presentation/animationHold';

/*
 * THE REACTIVITY WITNESS — the one instrument against the latch class behind the dead board of 2026-10-30: a module
 * predicate that a CACHE reads (the shell's `remote-landing` admission term, every animation-hold supplier) changed
 * through a plain `let`, and every cache kept its last answer for good. The witness keeps a cache of its own per
 * declared predicate; a difference from a fresh read can only be a non-reactive term — it is named, and healed for
 * every consumer through the predicate's own epoch.
 */
/** This spec's own predicates only — the audit is global, and a product latch is the bundle hook's to report. */
function own<T extends {label: string}>(latches: ReadonlyArray<T>): Array<T> {
  return latches.filter((l) => l.label.includes('spec-'));
}

describe('reactivityWitness — a predicate that caches read never latches silently', () => {
  const disposers: Array<() => void> = [];
  let warn: typeof console.warn;
  let warned: Array<string>;

  beforeEach(() => {
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(args.map(String).join(' '));
    };
    resetReactivityWitnessForTest();
  });

  afterEach(() => {
    console.warn = warn;
    disposers.splice(0).forEach((dispose) => dispose());
    resetReactivityWitnessForTest();
  });

  it('a predicate over reactive state only never latches — whatever it goes through', () => {
    const state = reactive({queued: 0, active: false});
    const owed = reactivePredicate('spec-reactive', () => state.queued > 0 || state.active);
    disposers.push(owed.dispose);
    auditReactivity(); // primes the witness
    for (const step of [() => state.queued++, () => state.active = true, () => state.queued--, () => state.active = false]) {
      step();
      expect(own(auditReactivity()).map((l) => l.label)).deep.eq([]);
    }
  });

  it('the latch window: a plain `let` term LATCHES every cache — the witness names it and HEALS the consumer through the epoch', () => {
    const state = reactive({queued: 0});
    let draining = false; // the remote stage's flag of 2026-10-30
    const owed = reactivePredicate('spec-latch', () => state.queued > 0 || draining);
    disposers.push(owed.dispose);
    const consumer = computed(() => owed()); // the shell's `remoteLandingBeforePlacement`
    auditReactivity();

    draining = true;
    state.queued = 1;
    expect(consumer.value, 'a reactive edge re-evaluates it').is.true;
    state.queued = 0;
    expect(consumer.value, 'the cache was re-read while the drain was still finishing').is.true;
    draining = false; // the drain's end — nothing reactive moved
    expect(consumer.value, 'the LATCH: the cache still answers «owed» with nothing owed').is.true;

    const latches = own(auditReactivity());
    expect(latches.map((l) => [l.label, l.cached, l.now])).deep.eq([['spec-latch', true, false]]);
    expect(consumer.value, 'healed — the consumer re-evaluated through the predicate\'s own epoch').is.false;
    expect(warned.some((w) => w.includes('[reactivity] «spec-latch» changed without a reactive edge')), 'named in the log').is.true;
    expect(recentReactivityLatches().some((l) => l.label === 'spec-latch')).is.true;
    expect(own(auditReactivity()), 'the witness re-armed at the fresh value — one latch, one report').deep.eq([]);
  });

  it('a POLLED predicate is healed every audit and never reported — the poll is a stated property', () => {
    let clock = 0;
    const due = reactivePredicate('spec-polled', () => clock > 10, {polled: 'a deadline reads the clock'});
    disposers.push(due.dispose);
    const consumer = computed(() => due());
    auditReactivity();
    expect(consumer.value).is.false;
    clock = 11;
    expect(own(auditReactivity()), 'not a contract violation').deep.eq([]);
    expect(consumer.value, 'but healed all the same').is.true;
    expect(warned.filter((w) => w.includes('spec-'))).deep.eq([]);
  });

  it('EVERY animation-hold supplier is witnessed by construction — a plain-term supplier is healed in the counts', () => {
    let held = false;
    registerAnimationHoldSupplier('spec-plain-supplier', () => held);
    disposers.push(() => unregisterAnimationHoldSupplier('spec-plain-supplier'));
    expect(reactivePredicateLabels()).includes('hold:spec-plain-supplier');
    auditReactivity();
    const before = animationHoldCount();
    held = true;
    expect(animationHoldCount(), 'the plain term reached no cache').eq(before);
    expect(own(auditReactivity()).map((l) => l.label)).deep.eq(['hold:spec-plain-supplier']);
    expect(animationHoldCount(), 'the audit healed the registry\'s counts').eq(before + 1);
    held = false;
    auditReactivity();
    expect(animationHoldCount()).eq(before);
    unregisterAnimationHoldSupplier('spec-plain-supplier');
    expect(reactivePredicateLabels(), 'an unregistered supplier leaves the audit').not.includes('hold:spec-plain-supplier');
  });

  it('a throwing predicate is skipped, never thrown into the tick', () => {
    let boom = false;
    const p = reactivePredicate('spec-throws', () => {
      if (boom) {
        throw new Error('boom');
      }
      return false;
    });
    disposers.push(p.dispose);
    auditReactivity();
    boom = true;
    expect(() => auditReactivity()).not.to.throw();
  });
});
