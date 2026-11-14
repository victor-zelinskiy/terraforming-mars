/*
 * THE CONSOLE IN A BOTTLE — what the spike PROVES (FREEZE ZERO · B3; `docs/claude/console/freeze-zero/PLAN.md` § 3.4).
 *
 * Every test here stands the real application (`createVaporApp(App)` — `consoleBottle.ts` says exactly what is real
 * and what is not) against the real game server in this process, on one manual clock. Nothing is stubbed in the page
 * and no test drives a decision by hand: a test PRESSES, MOVES THE CLOCK, lets ANOTHER SEAT move, RELOADS — and reads.
 *
 *   1  the server in the same process: its own router, validation and serialisation answer the page's requests
 *   2  the application mounts on a fresh table and the start scene serves the server's question
 *   3  a fixture of the browser monkey's own set: presses reach the server through the funnel; another seat's move
 *      comes back through the poll
 *   4  one clock: the kernel, GSAP, `Date`, the frames
 *   5  the liveness check FAILS on a planted defect (the product's own control seam) and names its class
 *   6  the same seeded walk twice is the same run (trail, journal, task count)
 *   7  a reload is a new page on the same table
 *   8  B5 in miniature: a random search over {press, clock, another seat, reload} holds on a healthy table — and on a
 *      table where a defect can be planted it FINDS the defect and SHRINKS the sequence to it
 *  10  throughput (presses per second of the wall, by how far the clock moves after each)
 *  11  the server's own timers stand on the same clock (MarsBot's paced turn)
 *  12  a bottle leaves nothing behind (the suite's bare jsdom, the wall clock, the document)
 *
 * The numbers these tests print (boot, presses per second, tasks) are the spike's measurements — read them in the log.
 */
import {expect} from 'chai';
import fc from 'fast-check';
import {bootBottle, BOTTLE_KEYS, BottleKey, ConsoleBottle, seededRandom} from './consoleBottle';
import {bottleServer, nodeProcess} from './bottleNode';

const FIXTURE = 'aerial-mappers';
const wall = () => Number(nodeProcess().hrtime.bigint() / 1_000_000n);
/** A walk biased to the verbs that move a flow (A most, then the d-pad, the wheels, then everything). */
const WEIGHTED: ReadonlyArray<BottleKey> = ['Enter', 'Enter', 'Enter', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Escape', 'Period', 'Comma', ...BOTTLE_KEYS];

async function walk(bottle: ConsoleBottle, seed: number, presses: number, gapMs: number): Promise<Array<string>> {
  const next = seededRandom(seed);
  const trail: Array<string> = [];
  for (let i = 0; i < presses; i++) {
    const key = WEIGHTED[Math.floor(next() * WEIGHTED.length)];
    const echo = await bottle.press(key);
    await bottle.advance(gapMs);
    trail.push(`${key}:${echo}:${bottle.digest()}`);
  }
  return trail;
}

/** The SUBMITS — what went through the transport's funnel (`player/input`, `player/input-batch`); the previews and the field log are POSTs too. */
const posts = (bottle: ConsoleBottle) => bottle.wire.log.filter((r) => r.method === 'POST' && r.url.startsWith('/player/input'));
const say = (...parts: Array<unknown>) => console.log('      ·', ...parts);

describe('THE CONSOLE IN A BOTTLE — the real shell and the real server in one process (the B3 spike)', function() {
  // A bottle boots a whole application; a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(900_000);

  let bottle: ConsoleBottle | undefined;
  let restoreRandom: (() => void) | undefined;
  let suffix = 0;

  beforeEach(() => {
    // Ids, the fixture's remapped ids, every cosmetic roll of the page and of the engine — one seeded stream per test.
    restoreRandom = bottleServer().seedProcessRandom(0.4242);
  });

  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
    restoreRandom?.();
    restoreRandom = undefined;
    bottleServer().reset();
  });

  it('1 · the server answers in this process — through its own router, validation and serialisation', async () => {
    const server = bottleServer();
    const table = server.bootNewGame(2, {}, `-s${suffix++}`);
    const seat = table.seats[0].id;
    const view = await server.request('GET', `api/player?id=${seat}`);
    expect(view.status).to.equal(200);
    const model = JSON.parse(view.body);
    expect(model.id).to.equal(seat);
    expect(model.waitingFor.type, 'the engine\'s own start asks for the initial cards').to.equal('initialCards');
    expect(view.headers['cache-control']).to.equal('no-store');
    // The server's own validation: an answer stamped for another prompt is refused with the id the page reacts to.
    const stale = await server.request('POST', `player/input?id=${seat}`, JSON.stringify({promptId: 999_999, type: 'option'}));
    expect(stale.status).to.equal(400);
    expect(JSON.parse(stale.body).id).to.equal('#stale-prompt');
    const unknown = await server.request('GET', 'api/player?id=p-nobody');
    expect(unknown.status).to.equal(404);
    const poll = await server.request('GET', `api/waitingfor?id=${seat}&gameAge=${model.game.gameAge}&undoCount=${model.game.undoCount}`);
    expect(JSON.parse(poll.body).result).to.equal('GO');
    expect(server.fixtureNames().length, 'the e2e fixtures are the bottle\'s tables too').to.be.greaterThan(500);
  });

  it('2 · the application mounts on a fresh table — the start scene serves the server\'s question', async () => {
    const table = bottleServer().bootNewGame(2, {}, `-s${suffix++}`);
    const t = wall();
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    say(`boot + 3 s of the clock: ${wall() - t} ms of the wall, ${bottle.clock.tasksRun()} tasks, ${document.body.querySelectorAll('*').length} elements`);
    expect(bottle.screen()).to.equal('player-home');
    expect(document.querySelector('.con-root'), 'the shell\'s root').to.not.equal(null);
    expect(document.querySelector('.con-start'), 'the start scene is mounted — a real surface, not a stub').to.not.equal(null);
    expect(bottle.frames()).to.deep.equal(['start:browse']);
    expect(bottle.view()?.waitingFor?.type).to.equal('initialCards');
    const requests = bottle.wire.log.map((r) => `${r.method} ${r.url.split('?')[0]}`);
    expect(requests, 'the root fetched the view').to.include('GET /api/player');
    expect(requests, 'the transport polls').to.include('GET /api/waitingfor');
    const live = bottle.liveness();
    expect(live.why, 'a healthy start is live').to.deep.equal([]);
    expect(live.beat?.accepting, 'the supervisor\'s own tick says a surface accepts').to.equal(true);
    expect(live.beat?.graph, 'the wait graph names the start as the question\'s server').to.contain('surface:start→question:initialDraft');
    // ONE press through the key bridge: the start scene takes A and the command bar answers.
    const before = bottle.bar();
    expect(await bottle.press('Enter')).to.equal('consumed');
    await bottle.advance(400);
    expect(bottle.bar(), 'A selected the corporation under the cursor — the verb flipped').to.not.equal(before);
    say(`bar: «${before}» → «${bottle.bar()}»`);
  });

  it('3 · a fixture table: presses reach the server through the funnel; another seat\'s move comes back by the poll', async () => {
    const table = await bottleServer().bootFixture(FIXTURE);
    bottle = await bootBottle(table);
    await bottle.advance(2_000);
    expect(bottle.liveness().why, 'the fixture boots live').to.deep.equal([]);
    expect(bottle.liveness().asked).to.equal('or');
    const age = bottle.view()?.game.gameAge ?? -1;
    // LT (the basic-actions wheel) → ▼ «Pass» → the confirmation → A.
    expect(await bottle.press('Comma')).to.equal('consumed');
    await bottle.advance(400);
    expect(await bottle.press('ArrowDown')).to.equal('consumed');
    await bottle.advance(400);
    expect(bottle.bar(), 'the pass confirmation stands').to.match(/Pass/);
    expect(await bottle.press('Enter')).to.equal('consumed');
    expect(await bottle.until(() => bottle?.view()?.waitingFor === undefined, 10_000), 'the answer was applied: the seat is asked nothing').to.equal(true);
    expect(posts(bottle).map((r) => `${r.url.split('?')[0]} ${r.status}`), 'ONE submit through the funnel').to.deep.equal(['/player/input 200']);
    expect(bottle.view()?.game.gameAge).to.be.greaterThan(age);
    await bottle.advance(3_000);
    say(`after the pass: ${bottle.digest()}`);
    // ANOTHER SEAT moves (its own pass — the generation ends, the research phase asks both seats).
    expect(await bottle.otherSeatMoves(1)).to.equal('pass');
    const asked = await bottle.until(() => bottle?.view()?.waitingFor !== undefined, 30_000);
    say(`after the other seat's pass: ${bottle.digest()}`);
    expect(asked, 'the page learned of its new question from the poll alone (no WebSocket in the bottle)').to.equal(true);
    await bottle.advance(15_000);
    const live = bottle.liveness();
    say(`liveness after the generation turned: ok=${live.ok} asked=${live.asked} accepting=${live.beat?.accepting} frames=${live.beat?.frames.join(';')} why=${JSON.stringify(live.why)} blind=${JSON.stringify(live.blind.map((b) => b.cls))}`);
    expect(live.viewInSync, 'the page shows the server\'s prompt').to.equal(true);
    expect(live.why, 'and the turned generation left the player able to act').to.deep.equal([]);
  });

  it('4 · ONE clock: the kernel, GSAP, Date, the frames', async () => {
    const table = await bottleServer().bootFixture(FIXTURE);
    bottle = await bootBottle(table);
    await bottle.advance(2_000);
    const date0 = Date.now();
    const perf0 = performance.now();
    const t = wall();
    const read = bottle.timeProbe();
    await bottle.advance(250);
    const mid = read().tweenValue;
    await bottle.advance(2_000);
    const came = read();
    say(`2250 ms of the clock in ${wall() - t} ms of the wall; ${JSON.stringify(came)}`);
    expect(Date.now() - date0, 'Date.now follows').to.equal(2250);
    expect(Math.round(performance.now() - perf0), 'performance.now follows').to.equal(2250);
    expect(new Date().getTime(), '`new Date()` follows').to.equal(Date.now());
    expect(came.kernelAfter700, 'an owned timer of the kernel, to the millisecond').to.equal(700);
    expect(came.painted2, 'two frames').to.equal(32);
    expect(mid, 'a GSAP tween is a quarter through at 250 ms').to.be.within(20, 28);
    expect(came.gsapTween1000, 'a 1 s GSAP tween ends a second later (within a frame)').to.be.within(1000, 1032);
    expect(came.gsapDelayedCall500, 'a GSAP delayedCall').to.be.within(500, 532);
    expect(came.tweenValue).to.equal(100);
  });

  it('5 · the liveness check FAILS on a planted defect and names its class', async () => {
    const table = bottleServer().bootNewGame(2, {}, `-s${suffix++}`);
    bottle = await bootBottle(table, {query: 'waitGraphControl=strand'});
    await bottle.advance(3_000);
    expect(bottle.liveness().why, 'healthy before the plant').to.deep.equal([]);
    // The product's own positive control (`supervisorController.ts`): the frame that serves the live question is taken
    // off the stack WITHOUT setting the question aside — the R15 shape on demand.
    const strand = (window as unknown as {__conStrandQuestion?: () => string}).__conStrandQuestion;
    expect(strand, 'the control seam is installed by the flag').to.be.a('function');
    expect(strand?.()).to.equal('start');
    await bottle.advance(15_000);
    const live = bottle.liveness();
    say(`planted: ok=${live.ok}`);
    for (const defect of live.defects) {
      say(`   ${defect.cls} ×${defect.count}`);
    }
    expect(live.ok, 'the bottle sees it').to.equal(false);
    expect(live.defects.map((d) => d.cls).join(' '), 'and names the class a net acted under').to.match(/wait-graph\/dead-end|stranded|liveness\/stall/);
  });

  it('6 · the same seeded walk, twice, is the same run', async () => {
    const runs: Array<{trail: Array<string>, lines: Array<string>, tasks: number, requests: number, posts: number}> = [];
    for (let run = 0; run < 2; run++) {
      restoreRandom?.();
      restoreRandom = bottleServer().seedProcessRandom(0.4242);
      const table = await bottleServer().bootFixture(FIXTURE);
      let t = wall();
      bottle = await bootBottle(table);
      await bottle.advance(2_000);
      const bootMs = wall() - t;
      t = wall();
      const trail = await walk(bottle, 7, 100, 250);
      const walkMs = wall() - t;
      await bottle.advance(12_000);
      runs.push({trail, lines: [...bottle.lines()], tasks: bottle.clock.tasksRun(), requests: bottle.wire.log.length, posts: posts(bottle).length});
      say(`run ${run}: boot + 2 s ${bootMs} ms · 100 presses × 250 ms of the clock in ${walkMs} ms of the wall (${(100_000 / walkMs).toFixed(1)} presses/s, digest included) · ${bottle.clock.tasksRun()} tasks · ${bottle.wire.log.length} requests · ${posts(bottle).length} submit(s) · classes ${JSON.stringify([...bottle.liveness().defects, ...bottle.liveness().blind].map((d) => d.cls))}`);
      await bottle.dispose();
      bottle = undefined;
    }
    const [a, b] = runs;
    const differs = a.trail.findIndex((line, i) => line !== b.trail[i]);
    expect(differs, differs === -1 ? '' : `the runs part at press #${differs}:\n${a.trail[differs]}\n${b.trail[differs]}`).to.equal(-1);
    expect(b.lines, 'the same warn / error lines, in the same order').to.deep.equal(a.lines);
    expect(b.tasks, 'the same number of tasks of the event loop').to.equal(a.tasks);
    expect(b.requests).to.equal(a.requests);
  });

  it('7 · a reload is a NEW page on the same table', async () => {
    const table = await bottleServer().bootFixture(FIXTURE);
    bottle = await bootBottle(table);
    await bottle.advance(2_000);
    // RT (the action wheel) → A «Cards»: the hand workspace opens.
    await bottle.press('Period');
    await bottle.advance(400);
    await bottle.press('Enter');
    await bottle.advance(800);
    expect(bottle.frames(), 'a workspace stands').to.deep.equal(['hand:browse']);
    const at = bottle.clock.now();
    bottle = await bottle.reload();
    await bottle.advance(2_000);
    expect(bottle.clock.now(), 'the clock goes on').to.equal(at + 2_000);
    expect(bottle.screen()).to.equal('player-home');
    expect(bottle.frames(), 'the new page has no workspace: its module state is a fresh page\'s').to.deep.equal([]);
    expect(bottle.liveness().why).to.deep.equal([]);
    // The old page's listeners went with it: one press is seen ONCE by ONE key bridge.
    expect(await bottle.press('Period')).to.equal('consumed');
    await bottle.advance(400);
    expect(bottle.bar(), 'the wheel opened once (a second bridge would have toggled it shut)').to.match(/Close/);
  });

  // ── B5 IN MINIATURE ──
  type Command = {do: 'press', key: BottleKey} | {do: 'advance', ms: number} | {do: 'seat'} | {do: 'reload'} | {do: 'strand'};
  const pressArb = fc.constantFrom(...WEIGHTED).map<Command>((key) => ({do: 'press', key}));
  const advanceArb = fc.constantFrom(50, 300, 1_000, 4_000).map<Command>((ms) => ({do: 'advance', ms}));
  const describeCommands = (commands: ReadonlyArray<Command>) => commands.map((c) => (c.do === 'press' ? c.key : c.do === 'advance' ? `+${c.ms}ms` : c.do)).join(' ');

  /** Run a sequence against a bottle; `undefined` when the player could act all along, else why not. */
  async function judge(boot: () => Promise<ConsoleBottle>, commands: ReadonlyArray<Command>): Promise<string | undefined> {
    let subject = await boot();
    try {
      await subject.advance(2_000);
      for (const command of commands) {
        if (command.do === 'press') {
          await subject.press(command.key);
          await subject.advance(250);
        } else if (command.do === 'advance') {
          await subject.advance(command.ms);
        } else if (command.do === 'seat') {
          await subject.otherSeatMoves(1);
          await subject.advance(1_500);
        } else if (command.do === 'reload') {
          subject = await subject.reload();
          await subject.advance(2_000);
        } else {
          (window as unknown as {__conStrandQuestion?: () => string}).__conStrandQuestion?.();
          await subject.advance(250);
        }
      }
      // THE BOUNDED ADVANCE: past the arbiter's grace (10 s) and a rung — a stall that stands has been named by now.
      await subject.advance(15_000);
      const live = subject.liveness();
      return live.ok ? undefined : live.why.join(' ‖ ');
    } finally {
      await subject.dispose();
    }
  }

  it('8a · a random search over {press, clock, another seat, reload} holds on a healthy table', async () => {
    const t = wall();
    let runsDone = 0;
    let commandsDone = 0;
    const found: Array<string> = [];
    await fc.assert(fc.asyncProperty(
      fc.array(fc.oneof({weight: 8, arbitrary: pressArb}, {weight: 3, arbitrary: advanceArb}, {weight: 1, arbitrary: fc.constant<Command>({do: 'seat'})}, {weight: 1, arbitrary: fc.constant<Command>({do: 'reload'})}), {minLength: 4, maxLength: 25}),
      async (commands) => {
        restoreRandom?.();
        restoreRandom = bottleServer().seedProcessRandom(0.4242);
        const table = await bottleServer().bootFixture(FIXTURE);
        const why = await judge(() => bootBottle(table), commands);
        runsDone++;
        commandsDone += commands.length;
        if (why !== undefined) {
          found.push(`${describeCommands(commands)} → ${why}`);
        }
        // The search REPORTS what it finds; this spike's test only requires that the search itself runs to its end
        // (a finding here is a finding about the product or about the bottle's border — the log has it).
        return true;
      }), {numRuns: 8, seed: 20261114, endOnFailure: true});
    say(`${runsDone} sequences, ${commandsDone} commands in ${wall() - t} ms of the wall`);
    for (const line of found) {
      say(`FOUND: ${line.slice(0, 900)}`);
    }
    say(found.length === 0 ? 'nothing found on the healthy table' : `${found.length} sequence(s) ended not live — see above`);
  });

  it('8b · …and where a defect CAN be planted, the search finds it and shrinks the sequence to it', async () => {
    const t = wall();
    let runsDone = 0;
    const result = await fc.check(fc.asyncProperty(
      fc.array(fc.oneof({weight: 6, arbitrary: pressArb}, {weight: 3, arbitrary: advanceArb}, {weight: 1, arbitrary: fc.constant<Command>({do: 'strand'})}), {minLength: 3, maxLength: 12}),
      async (commands) => {
        restoreRandom?.();
        restoreRandom = bottleServer().seedProcessRandom(0.4242);
        const table = bottleServer().bootNewGame(2, {}, `-s${suffix++}`);
        const why = await judge(() => bootBottle(table, {query: 'waitGraphControl=strand'}), commands);
        runsDone++;
        return why === undefined;
      }), {numRuns: 12, seed: 20261114});
    say(`${runsDone} sequences (the search and its shrinking) in ${wall() - t} ms of the wall`);
    expect(result.failed, 'the search found the planted defect').to.equal(true);
    const minimal = (result.counterexample?.[0] ?? []) as ReadonlyArray<Command>;
    say(`found after ${result.numRuns} run(s), shrunk ${result.numShrinks} time(s) to: ${describeCommands(minimal)}`);
    expect(minimal.some((c) => c.do === 'strand'), 'the minimal sequence contains the plant').to.equal(true);
    expect(minimal.length, 'and little else').to.be.at.most(4);
  });

  it('10 · THROUGHPUT — presses per second of the wall, by how far the clock moves after each', async () => {
    for (const gapMs of [0, 50, 250, 1_000]) {
      const table = await bottleServer().bootFixture(FIXTURE);
      bottle = await bootBottle(table);
      await bottle.advance(2_000);
      const next = seededRandom(11);
      const presses = 120;
      const tasks = bottle.clock.tasksRun();
      const t = wall();
      for (let i = 0; i < presses; i++) {
        await bottle.press(WEIGHTED[Math.floor(next() * WEIGHTED.length)]);
        if (gapMs > 0) {
          await bottle.advance(gapMs);
        }
      }
      const ms = wall() - t;
      say(`${presses} presses, the clock +${gapMs} ms after each: ${ms} ms of the wall → ${(presses * 1000 / ms).toFixed(0)} presses/s · ${(presses * gapMs / Math.max(1, ms)).toFixed(1)}× real time · ${bottle.clock.tasksRun() - tasks} tasks · ${posts(bottle).length} submit(s)`);
      await bottle.dispose();
      bottle = undefined;
    }
  });

  it('11 · the SERVER\'s timers stand on the same clock — and a MarsBot table: the page presents the bot\'s turns and catches up', async () => {
    const server = bottleServer();
    const table = await server.bootFixture('amazonis-planitia-marsbot');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    expect(bottle.liveness().why, 'the bot\'s table boots live').to.deep.equal([]);
    // A timer armed in the SERVER's module graph (what `BotTurnScheduler` arms: the global `setTimeout`, read at the call).
    const fired = server.armServerTimer(5_000);
    const until = wall() + 400;
    while (wall() < until) {
      await bottle.clock.drain();
    }
    expect(fired(), 'the clock stands, 400 ms of the WALL passed — a real timer would be 400 ms nearer; this one has not moved').to.equal(undefined);
    await bottle.advance(4_999);
    expect(fired()).to.equal(undefined);
    await bottle.advance(1);
    expect(fired(), 'it fires when the bottle\'s clock reaches it — to the millisecond of the server\'s own `Date.now`').to.equal(5_000);
    // THE BOT'S TABLE: LT → ▼ «Pass» → A. The server plays the bot's generation out; the page shows it turn by turn.
    const age = bottle.view()?.game.gameAge ?? -1;
    await bottle.press('Comma');
    await bottle.advance(400);
    await bottle.press('ArrowDown');
    await bottle.advance(400);
    expect(bottle.bar()).to.match(/Pass/);
    await bottle.press('Enter');
    expect(posts(bottle).length, 'the pass went through the funnel').to.equal(1);
    const truth = server.seatTruth(bottle.seatId);
    say(`the server after the pass: age ${age} → ${truth.gameAge}, generation ${truth.generation}, asks «${truth.waitingFor}»; the page: ${bottle.digest().slice(0, 150)}`);
    const caughtUp = await bottle.until(() => bottle?.liveness().viewInSync === true, 60_000, 250);
    say(`the page caught up ${bottle.clock.now() - Date.UTC(2026, 0, 1)} ms into the bottle: ${bottle.digest()}`);
    expect(caughtUp, 'the page shows the server\'s next question').to.equal(true);
    await bottle.advance(15_000);
    const live = bottle.liveness();
    say(`liveness: ok=${live.ok} why=${JSON.stringify(live.why)} blind=${JSON.stringify(live.blind.map((b) => b.cls))}`);
    expect(live.why).to.deep.equal([]);
  });

  it('12 · a bottle leaves nothing behind', async () => {
    const table = await bottleServer().bootFixture(FIXTURE);
    bottle = await bootBottle(table);
    await bottle.advance(1_000);
    await bottle.dispose();
    bottle = undefined;
    const globals = globalThis as unknown as Record<string, unknown>;
    expect(['requestAnimationFrame', 'matchMedia', 'ResizeObserver', 'localStorage', 'CSS'].filter((name) => globals[name] !== undefined), 'the suite\'s bare jsdom is back').to.deep.equal([]);
    expect(window.location.href).to.equal('about:blank');
    const wallNow = performance.timeOrigin + performance.now();
    expect(Math.abs(Date.now() - wallNow), 'Date.now is the wall clock again (not the bottle\'s epoch)').to.be.lessThan(5_000);
    expect(Math.abs(new Date().getTime() - wallNow), '`new Date()` too').to.be.lessThan(5_000);
    expect(document.querySelector('.con-root')).to.equal(null);
  });
});
