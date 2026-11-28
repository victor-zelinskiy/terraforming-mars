/*
 * THE CLASS, REPLAYED — «A QUESTION NOBODY SERVES AFTER A SUBMIT THAT DID NOT LAND» (FREEZE ZERO — the audit of
 * 2026-11-28, cluster A2; issues #119 · #170 · #171 · #172 · #177: one family, reopened four times after three
 * pointwise cures).
 *
 * THE FIELD — CI's autopilot, run 46144276012 on `983c3b60d0`, a real browser, two STORM games:
 *
 *  · game 630 (Hollandia, two humans) — `318914:Period{-|or#2335|Конец партии · A Выбрать клетку · R3 Все клетки ·
 *    RT Завершить свою партию · B Свернуть} [HOLD] [WEATHER lost #3]` → `[net] the submit — TypeError: Failed to fetch`
 *    → one second later `[console-leak-detector] STRANDED PROMPT: waitingFor "or" (task kind "choice")` → `[screen-shadow]
 *    unserved — expected «task», on screen «nothing»` → `expired lease:mandatory-choice×1` → `[liveness] stall (unserved)
 *    … top: board; holder: stranded; claim: none; holds: none — the ladder is spent` → `[session-rebuild] page`;
 *  · game 621 (a campaign game) — the SAME press: `102619:Period [HOLD] [WEATHER stale #5] [REFUSED 400
 *    {"id":"#stale-prompt"…}]` → the same lines 1.4 s later, the same rebuild. (The hand-over read «no direct link,
 *    the last failed submit was ≈ 165 s earlier»: a 400 prints no `[net]` line. The link is direct.)
 *
 * ONE ROAD, both times: the FINALE's «Завершить свою партию» — the hold on RT that answers the finale's `or` with its
 * «I am done» branch — whose submit did not land. `placementController.finishFinalGreenery` drops the board pick and
 * raises `finalGreeneryCommitting` for the press, and declares NO unwind for it: the two unwinds beside it
 * (`task-space-commit` — 6d2068b2bb, the cell's commit under a 503; `final-offer-commit` — 4d74b4f9a0, RX35's exchange)
 * each answer for their own press only. The latch's one release is «an applied view» — an EDGE; the view re-fetched
 * after a request the server never saw is IDENTICAL, `nextViewSnapshot` hands the old object back, no reaction runs.
 * The finale session then holds the prompt for good (`finalePromptOwned` keeps the host and the plate off it, the
 * owner function names the hold «scene finale») on its `landing` stage, which serves nothing: the bar's RT is drawn
 * disabled, B and the plate's A lead back to the same stage.
 *
 * THE PROPERTY (the law a cure must establish — the report R2-stranded-after-refused-submit): after ANY end of a
 * submit that is not «applied», the question the server still holds is served as on a fresh page — within the manual
 * clock's seconds, with nothing on the wire, by no net and no rebuild. Asserted, like every replay, on the product's
 * own journal (the defect classes), on the kernel's tree and on what the player has on screen.
 *
 * RED → GREEN. On the code as it stood the control was green (the cell's commit had its unwind) and every row of the
 * class was RED — the three classes of game 630's own file, class for class, and one rebuild. THE CURE IS A LAW, not a
 * third unwind: `finalGreeneryCommitting` is a `pressState` (`session/pressState.ts`) — a latch a press raises is bound
 * to the submit that press makes and falls with it by every road that leaves the move unmade — and a question whose
 * answer is on the wire is held by its submit for the judges (`pressState.submitInFlight`; without that row the
 * `silent` case files `stranded-prompt/choice` inside the transport's minute — a late answer is no strand).
 */
import {expect} from 'chai';
import {bootBottle, BottleKey, ConsoleBottle} from './consoleBottle';
import {bottleServer} from './bottleNode';
import {armFault} from './monkeyWalk';
import type {WireFault} from './bottleNet';

/** The transport gives a request the server never answers up after its minute (`submitMachine.SUBMIT_NO_RESPONSE_MS`). */
const SILENCE_MS = 61_000;
/** Past everything that judges a standing screen: the leak detector's second, the plate's lease, the arbiter's ladder. */
const JUDGED_MS = 20_000;

describe('A QUESTION NOBODY SERVES AFTER A SUBMIT THAT DID NOT LAND — the finale\'s finish, replayed in the bottle', function() {
  // A bottle boots a whole application; a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(600_000);
  let bottle: ConsoleBottle | undefined;

  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
  });

  /**
   * A HOLD — the button goes down, the ring closes on the bottle's clock (`consoleHoldConfirm.HOLD_CONFIRM_MS`, 700 ms;
   * the browser pilot keeps it down 1 400), the button comes up. `ConsoleBottle.press` is a tap: down and up at once.
   */
  async function hold(live: ConsoleBottle, key: BottleKey, ms = 1_400): Promise<void> {
    const page = (globalThis as unknown as {window: {dispatchEvent(event: Event): boolean}}).window;
    const KeyEvent = (globalThis as unknown as {KeyboardEvent: new (type: string, init: object) => Event}).KeyboardEvent;
    page.dispatchEvent(new KeyEvent('keydown', {code: key, key, bubbles: true, cancelable: true}));
    await live.advance(ms);
    page.dispatchEvent(new KeyEvent('keyup', {code: key, key, bubbles: true, cancelable: true}));
    await live.clock.drain();
  }

  /** The table of the field's finale: the viewer holds the finale's `or`, the plate's A puts the pick out on the board. */
  async function standInTheFinale(): Promise<ConsoleBottle> {
    const table = await bottleServer().bootFixture('two-player-finale-trigger');
    const live = await bootBottle(table);
    bottle = live;
    await live.advance(4_000);
    for (let i = 0; i < 6 && !/Select cell/.test(live.bar()); i++) {
      await live.press('Enter');
      await live.advance(1_200);
    }
    expect(live.bar(), 'the finale stands: the pick is out, RT is the finish').to.match(/Select cell.*Finish your game.*Minimize/);
    expect(bottleServer().seatTruth(live.seatId).waitingFor, 'the server asks the finale\'s `or`').to.equal('or');
    return live;
  }

  /**
   * WHAT STANDS — by the product's own word: the screen (`standing` — «no surface accepts», «the question is
   * STRANDED»), the journal's defect classes, the page rebuilds the last line asked for, and the kernel's tree (the
   * commit latch — a `step` scope — standing with nothing on the wire).
   */
  function whatStands(live: ConsoleBottle): {standing: Array<string>, filed: Array<string>, rebuilds: number, commitLatch: number} {
    // (The transport's own word for a server that never answered is the fault's, not the screen's.)
    const own = (cls: string): boolean => cls === 'transport/server-silent';
    return {
      standing: live.liveness().standing,
      filed: live.liveness().defects.map((d) => d.cls).filter((cls) => !own(cls)),
      rebuilds: live.rebuildsAsked(),
      commitLatch: live.flow().tree.filter((line) => /step:final-greenery-committing/.test(line)).length,
    };
  }
  const SERVED = {standing: [], filed: [], rebuilds: 0, commitLatch: 0};

  /*
   * THE CONTROL — the SAME table, the SAME question, the SAME fault, the press beside it: the cell's commit. Its
   * unwind is declared (`task-space-commit`, 6d2068b2bb — CI's game 303): the pick is put back out on the same
   * question. This is the property, attained — and what the class's rows below are held to.
   */
  it('CONTROL — the finale\'s CELL commit the network lost: the pick is back out on the same question, nothing is filed, nothing is rebuilt', async () => {
    const live = await standInTheFinale();
    const asked = bottleServer().seatTruth(live.seatId).promptId;
    await live.press('Enter');
    await live.advance(500);
    expect(live.bar(), 'the cell is locked — A confirms').to.match(/Confirm placement/);
    armFault(live, 'network', 'submit');
    await live.press('Enter');
    await live.advance(1_400);
    expect(live.wire.faulted.map((f) => f.fault), 'the commit\'s submit took the fault').to.deep.equal(['network']);
    expect(bottleServer().seatTruth(live.seatId).promptId, 'the move was not made: the server asks the very same question').to.equal(asked);
    expect(live.bar(), 'the alert is what the pad answers').to.match(/OK/);
    await live.press('Enter');
    await live.advance(JUDGED_MS);
    expect(live.wire.inFlight(), 'nothing is on the wire').to.equal(0);
    expect(whatStands(live), 'the question is served: the screen accepts, nothing filed, nothing rebuilt, no commit latch left').to.deep.equal(SERVED);
    expect(live.bar(), 'the pick is back out — the finale\'s own verbs').to.match(/(Select cell|Confirm placement).*/);
  });

  /*
   * THE CLASS — every way the wire leaves the move UNMADE (`bottleNet.WireFault`: the first five; `lost` and
   * `malformed` make the move, and the re-fetched view then differs), on the finish's hold:
   *   network   — game 630's (`[WEATHER lost]`: the fetch fails; the transport re-fetches, the view is identical);
   *   stale     — game 621's (`[WEATHER stale]`: 400 `#stale-prompt`; the transport re-fetches, identical);
   *   refused   — a 400 with no id (no re-fetch at all);
   *   error500  — a restarting server's page (no re-fetch at all);
   *   silent    — no answer for the transport's minute (re-fetched, identical).
   */
  const UNMADE: ReadonlyArray<{fault: WireFault, field: string}> = [
    {fault: 'network', field: 'game 630 — «lost»'},
    {fault: 'stale', field: 'game 621 — «stale»'},
    {fault: 'refused', field: 'a 400 with no id'},
    {fault: 'error500', field: 'a 5xx page'},
    {fault: 'silent', field: 'no answer for the transport\'s minute'},
  ];
  for (const {fault, field} of UNMADE) {
    it(`the finale's FINISH held to its ring, the submit did not land — ${fault} (${field}): the question is still the server's and it is SERVED — no strand, no expired lease, no spent ladder, no rebuild`, async () => {
      const live = await standInTheFinale();
      const asked = bottleServer().seatTruth(live.seatId).promptId;

      // THE PRESS OF THE FIELD: RT held until the ring closes — «Завершить свою партию».
      armFault(live, fault, 'submit');
      await hold(live, 'Period');
      if (fault === 'silent') {
        await live.advance(SILENCE_MS);
      }
      expect(live.wire.faulted.map((f) => f.fault), 'the finish\'s submit took the fault').to.deep.equal([fault]);
      expect(bottleServer().seatTruth(live.seatId), 'the move was NOT made: the server asks the very same question')
        .to.include({waitingFor: 'or', promptId: asked});
      expect(live.bar(), 'the alert says so, and is what the pad answers').to.match(/OK/);

      // A dismisses the alert (the pilot's 320547:Enter) — and the player waits for their screen.
      await live.press('Enter');
      await live.advance(JUDGED_MS);
      expect(live.wire.inFlight(), 'nothing is on the wire').to.equal(0);
      expect(live.view()?.waitingFor?.promptId, 'the page holds the server\'s question').to.equal(asked);

      // THE CLASS's OWN SIGNATURE, by the product's word.
      expect(whatStands(live), 'the server asks, nothing is in flight — and the question is SERVED: the screen accepts, nothing is filed ' +
        '(no `stranded-prompt`, no expired `mandatory-choice` lease, no `liveness/stall/unserved`), the page is not rebuilt, no commit latch stands')
        .to.deep.equal(SERVED);
      expect(live.bar(), 'the pick is back out with the finish beside it — the player\'s own verbs on the same question').to.match(/Select cell.*Finish your game/);

      // …and the finish, held again on a quiet wire, ENDS the seat's finale: the server moves on.
      await hold(live, 'Period');
      await live.advance(3_000);
      expect(bottleServer().seatTruth(live.seatId).promptId, 'the second finish landed').to.not.equal(asked);
    });
  }
});
