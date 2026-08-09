import {expect} from 'chai';
import {
  arrivalSourceFan, cardArrivalBudgetMs, cardArrivalTimings, planCardArrival,
  reducedCardArrivalTimings, resolveCardArrivalMode,
} from '@/client/console/consoleCardArrival';

/**
 * THE BATCH ARRIVAL PLAN — the pure half of «N cards physically come off the
 * deck and land in N prepared slots».
 *
 * The bug this system replaced was structural, not cosmetic: ONE proxy flew
 * into ONE slot and the surface that took the zone afterwards rendered the
 * whole batch, so a two-card draw read as one card arriving and multiplying.
 * These specs pin the invariants that make that unrepresentable — a batch of
 * N is N beats, each with its own launch time and its own slot, and the mode
 * that decides whether a card opens in flight is SEMANTIC, never a timing.
 */
describe('consoleCardArrival — the batch plan', () => {
  const t = cardArrivalTimings();

  describe('mode resolution is semantic', () => {
    it('a deck CHECK is always the deliberate face-down reveal', () => {
      // Search For Life & co: the opening IS the game event, so it keeps its
      // land-then-turn drama even when the answer is already in hand.
      expect(resolveCardArrivalMode({kinds: ['deck-check'], dataReady: true}))
        .to.eq('conditional-reveal');
      expect(resolveCardArrivalMode({kinds: ['deck-check'], dataReady: false}))
        .to.eq('conditional-reveal');
    });

    it('a normal draw with known faces opens IN FLIGHT', () => {
      expect(resolveCardArrivalMode({kinds: ['draw', 'pick'], dataReady: true}))
        .to.eq('in-flight-reveal');
    });

    it('a normal draw without faces waits honestly — never a fake reveal', () => {
      expect(resolveCardArrivalMode({kinds: ['draw', 'pick'], dataReady: false}))
        .to.eq('awaiting-data');
    });

    it('being slow can never promote a draw into the deliberate reveal', () => {
      // The whole point of the split: a late server produces `awaiting-data`,
      // and the deliberate beat stays reserved for actions that MEAN it.
      expect(resolveCardArrivalMode({kinds: ['draw'], dataReady: false}))
        .to.not.eq('conditional-reveal');
    });
  });

  describe('N cards are N objects', () => {
    it('one beat per card, each aimed at its own slot index', () => {
      const plan = planCardArrival(3, t, 'in-flight-reveal');
      expect(plan.beats.map((b) => b.index)).to.deep.eq([0, 1, 2]);
    });

    it('launches are staggered but overlapping — a batch, not a dealer', () => {
      const plan = planCardArrival(4, t, 'in-flight-reveal');
      const starts = plan.beats.map((b) => b.atMs);
      // Strictly increasing…
      expect(starts).to.deep.eq([...starts].sort((a, b) => a - b));
      expect(new Set(starts).size).to.eq(4);
      // …but the LAST card leaves long before the FIRST one lands, so the
      // group reads as one draw instead of four handed out in turn.
      expect(starts[3]).to.be.lessThan(plan.beats[0].landAtMs * 0.5);
    });

    it('the count is legible before the FIRST card even lands', () => {
      // The player must never learn HOW MANY cards are coming only on arrival.
      // Stated against the first card's LANDING rather than a fraction of the
      // scene: that is the moment the answer would otherwise arrive, it holds
      // for a batch of any size (a seven-card reveal included), and it does not
      // silently re-tune itself when the travel leg or the cascade is adjusted.
      for (const n of [2, 3, 4, 7, 12]) {
        const plan = planCardArrival(n, t, 'in-flight-reveal');
        const last = plan.beats[n - 1];
        expect(last.atMs + t.peelMs, `n=${n}`).to.be.lessThan(plan.beats[0].landAtMs);
      }
    });

    it('the stagger TIGHTENS — a bigger batch never becomes a queue', () => {
      const starts = planCardArrival(5, t, 'in-flight-reveal').beats.map((b) => b.atMs);
      const gaps = starts.slice(1).map((v, i) => v - starts[i]);
      for (let i = 1; i < gaps.length; i++) {
        expect(gaps[i]).to.be.lessThanOrEqual(gaps[i - 1]);
      }
      // …and five cards cost barely more than two.
      expect(planCardArrival(5, t, 'in-flight-reveal').totalMs)
        .to.be.lessThan(planCardArrival(2, t, 'in-flight-reveal').totalMs * 1.4);
    });

    it('…but the tightening has a FLOOR — the pile never coughs', () => {
      // Geometric decay is unbounded: past the fifth card it produces two-frame
      // gaps, and «another card left the deck» stops being an event at all.
      const starts = planCardArrival(12, t, 'in-flight-reveal').beats.map((b) => b.atMs);
      const gaps = starts.slice(1).map((v, i) => v - starts[i]);
      expect(Math.min(...gaps)).to.be.greaterThanOrEqual(t.stepMinMs - 1e-9);
    });

    it('⚠️ THE LANDINGS ARE COUNTABLE — no two cards arrive in one blink', () => {
      // The defect this pins: launch and landing shared one schedule, so the
      // launch decay WAS the landing decay and a seven-card draw put its last
      // four arrivals 58, 50 and 43 ms apart — under the threshold at which the
      // eye separates events. Seven placements read as one flash («слишком
      // резко»). The cadence is now a floor the plan owes, at every count.
      for (const n of [2, 3, 4, 5, 6, 7, 8]) {
        const lands = planCardArrival(n, t, 'in-flight-reveal').beats.map((b) => b.landAtMs);
        const gaps = lands.slice(1).map((v, i) => v - lands[i]);
        expect(Math.min(...gaps, Infinity), `n=${n} — ${JSON.stringify(gaps)}`)
          .to.be.greaterThanOrEqual(t.minLandGapMs - 1e-6);
        // …bought by staying in the air, never by launching late: the cascade
        // off the pile is untouched by the cadence.
        const starts = planCardArrival(n, t, 'in-flight-reveal').beats.map((b) => b.atMs);
        const bare = planCardArrival(n, {...t, minLandGapMs: 0}, 'in-flight-reveal')
          .beats.map((b) => b.atMs);
        expect(starts, `n=${n} launches unchanged`).to.deep.eq(bare);
      }
    });

    it('past the stretch budget the tail TIGHTENS — it never drifts, and never collapses', () => {
      // The cadence is bought with flight time, and flight time is capped
      // (`travelStretchMax`) because a throw held too long stops being a throw.
      // Beyond that budget — only reachable past any count this game produces,
      // the largest real reveal being seven — the plan is allowed to close the
      // cadence back up, but never to the flash it replaced.
      const lands = planCardArrival(16, t, 'in-flight-reveal').beats.map((b) => b.landAtMs);
      const gaps = lands.slice(1).map((v, i) => v - lands[i]);
      expect(Math.min(...gaps), JSON.stringify(gaps))
        .to.be.greaterThan(t.minLandGapMs * 0.5);
      for (const b of planCardArrival(16, t, 'in-flight-reveal').beats) {
        expect(b.travelMs).to.be.lessThanOrEqual(t.travelMs * t.travelStretchMax + 1e-6);
      }
    });

    it('a stretched flight keeps its turn proportional to its OWN travel', () => {
      // A card held back to keep the cadence flies longer; a flip duration
      // inherited from the base travel would open it early and leave it
      // coasting face-up for the rest of the path.
      const plan = planCardArrival(7, t, 'in-flight-reveal');
      const last = plan.beats[6];
      expect(last.travelMs, 'the tail card is genuinely in the air longer')
        .to.be.greaterThan(plan.beats[0].travelMs);
      expect(last.flipMs / last.travelMs).to.be.closeTo(t.flipSpan, 1e-9);
      expect((last.flipAtMs as number) - last.atMs - last.peelMs)
        .to.be.closeTo(last.travelMs * t.flipAt, 1e-9);
      expect(last.travelMs, 'and never drifts').to.be.lessThanOrEqual(t.travelMs * t.travelStretchMax);
    });

    it('a batch of 2–4 is delivered in about a second', () => {
      for (const n of [2, 3, 4]) {
        const plan = planCardArrival(n, t, 'in-flight-reveal');
        expect(plan.totalMs).to.be.greaterThan(700);
        // A hair over a second rather than under it: the extra is the landing
        // cadence, which is what turned three arrivals into three arrivals.
        expect(plan.totalMs, `n=${n}`).to.be.lessThan(1400);
      }
    });

    it('seven cards stay a draw, not a ceremony', () => {
      expect(planCardArrival(7, t, 'in-flight-reveal').totalMs).to.be.lessThan(1900);
    });

    it('an empty batch is a legal no-op', () => {
      const plan = planCardArrival(0, t, 'in-flight-reveal');
      expect(plan.beats).to.have.length(0);
      expect(plan.totalMs).to.eq(0);
    });
  });

  describe('the turn rides the trajectory', () => {
    it('in-flight mode gives every card a flip window inside its travel', () => {
      const plan = planCardArrival(3, t, 'in-flight-reveal');
      for (const b of plan.beats) {
        expect(b.flipAtMs, 'flip start').to.not.eq(undefined);
        const start = b.flipAtMs as number;
        // Starts only once the card is clearly out of the pile…
        expect(start).to.be.greaterThan(b.atMs + b.peelMs);
        // …and finishes before the landing phase, so the card arrives OPEN.
        expect(start + b.flipMs).to.be.lessThan(b.landAtMs + 1e-6);
      }
    });

    it('the waiting and deliberate modes carry NO in-flight turn', () => {
      for (const mode of ['awaiting-data', 'conditional-reveal'] as const) {
        for (const b of planCardArrival(2, t, mode).beats) {
          expect(b.flipAtMs, mode).to.eq(undefined);
        }
      }
    });

    it('the late-answer window closes before the card commits to its slot', () => {
      // Past this point a turn could not complete in flight, so the card opens
      // where it stands instead — which is what keeps the switch seamless.
      for (const b of planCardArrival(3, t, 'awaiting-data').beats) {
        expect(b.flipWindowEndsMs).to.be.lessThan(b.landAtMs);
        expect(b.flipWindowEndsMs).to.be.greaterThan(b.atMs + b.peelMs);
      }
    });
  });

  describe('the source fan makes the stack read as several cards', () => {
    it('is centred and symmetric', () => {
      const fan = arrivalSourceFan(4, 40);
      const sum = fan.reduce((acc, f) => acc + f.dx, 0);
      expect(sum).to.be.closeTo(0, 1e-9);
      expect(fan[0].dx).to.be.lessThan(0);
      expect(fan[3].dx).to.be.greaterThan(0);
    });

    it('gives every card a DISTINCT birth position', () => {
      const fan = arrivalSourceFan(3, 40);
      expect(new Set(fan.map((f) => f.dx)).size).to.eq(3);
    });

    it('is deterministic (plans never use Math.random here)', () => {
      expect(arrivalSourceFan(3, 40)).to.deep.eq(arrivalSourceFan(3, 40));
    });

    it('…and stays a STACK however many cards there are', () => {
      // A fixed per-card step is a stack for three and a spread hand for seven:
      // seven cards were born across two and a half piles, so the batch was
      // already scattered before anything moved and the launch could only read
      // as a burst. The WHOLE fan is bounded, so the birth pose is a stack at
      // every count and the separation afterwards is the event.
      const deckW = 40;
      for (const n of [2, 3, 4, 7, 12]) {
        const fan = arrivalSourceFan(n, deckW);
        const width = Math.max(...fan.map((f) => f.dx)) - Math.min(...fan.map((f) => f.dx));
        expect(width, `n=${n} — ${width}px over a ${deckW}px pile`)
          .to.be.lessThanOrEqual(deckW * 1.2);
        expect(new Set(fan.map((f) => f.dx)).size, `n=${n} distinct`).to.eq(n);
      }
    });

    it('a single card is born on the pile, unfanned', () => {
      expect(arrivalSourceFan(1, 40)).to.deep.eq([{dx: 0, dy: 0}]);
      expect(arrivalSourceFan(0, 40)).to.deep.eq([]);
    });
  });

  describe('reduced motion keeps the story, drops the theatrics', () => {
    const r = reducedCardArrivalTimings();

    it('is markedly shorter but still a complete physical path', () => {
      const full = planCardArrival(3, t, 'in-flight-reveal');
      const short = planCardArrival(3, r, 'in-flight-reveal');
      expect(short.totalMs).to.be.lessThan(full.totalMs * 0.4);
      expect(short.beats).to.have.length(3);
      expect(short.beats[2].atMs).to.be.greaterThan(0); // still separate cards
    });
  });

  it('the safety budget always exceeds the scene it guards', () => {
    const plan = planCardArrival(3, t, 'awaiting-data');
    expect(cardArrivalBudgetMs(plan, t)).to.be.greaterThan(plan.totalMs);
  });
});
