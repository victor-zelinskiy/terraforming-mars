/*
 * THE AUTOPILOT — A WHOLE GAME THROUGH THE REAL UI (FREEZE ZERO, stage 6 — «whole games and time»).
 *
 * The monkey walks sixty presses from a fixture and never ends a game: what a game does only as a WHOLE — fourteen
 * generations of research, turns, production and scenes on ONE page, a stack opened and closed two hundred times, the
 * finale after all of it — no walk ever stood on. The autopilot plays a table from its first press to the final
 * scoring, on the bottle's manual clock, the viewer's seat THROUGH THE CONSOLE:
 *
 *  · THE VIEWER presses what the screen offers (the guided pick of `monkeyWalk.ts` — the bar's verbs, the hot one
 *    first; some cursor moves; a few presses of anything). On its ACTION MENU it plays for a seeded while and then
 *    PASSES the way a player does — the basic wheel's ↓ and its confirm.
 *  · THE OTHER SEATS answer by the engine fuzz's generator — a random LEGAL answer through the server's own door
 *    (`bottleServerHost.seatAnswersRandomly`); MarsBot plays on the server's own timers, which are this clock's.
 *  · A QUESTION THE WALK DID NOT GET THROUGH in its budget of presses is answered the same way FOR the viewer — as
 *    another device of the same seat would — and COUNTED by the question's type (`byApi`): a game must end, and the
 *    count says where the screen and a seeded thumb part. It is a statistic of the walk, never a defect by itself; what
 *    judges the page is what always judges it — the journal by cause class, the liveness arbiter, the rebuilds.
 *
 * The whole run is a function of its seed: the table (`fuzzConfig(seed)`), the engine's rng, the presses, the pauses,
 * the other seats' answers.
 */
import type {BottleKey, ConsoleBottle} from './consoleBottle';
import {bottleServer} from './bottleNode';
import {monkeyPick, monkeyRng} from './monkeyWalk';

export type AutopilotOptions = {
  /** The walk's cap of presses — a game left standing at it is `capped`, read by where it stood. */
  maxPresses?: number,
  /** Presses on ONE question (not the action menu) before it is answered for the viewer through the server's door. */
  questionBudget?: number,
  /** Presses on one standing of the action menu before the viewer passes: drawn per menu from this range. */
  menuBudget?: readonly [number, number],
  /** The chance that a menu is passed at once (generations must end — the fuzz's own `pass` knob, a little higher). */
  passAtOnce?: number,
  /** Quiet seconds of the SERVER (nobody asked, nothing moving its age) after which the table is called stuck. */
  stuckAfterS?: number,
  /** Presses of the finale (the END phase: the ceremony's screens) before the last word. */
  finalePresses?: number,
  /** Called where the door is about to answer for the viewer — the screen still stands as the walk left it (a reading aid). */
  onDoor?: (what: string) => void,
  /**
   * THE SOAK's SAMPLE (stage 6 — «flat over a whole game»): called ONCE A GENERATION, at the same place every time —
   * the viewer's action menu with nothing on the stack (the board home) — so what it counts (DOM nodes, the kernel's
   * scopes and waits, armed timers, the heap) is comparable from generation to generation. A page that leaks grows.
   */
  sample?: () => Record<string, number>,
  /** A word about the page appended to every press of the log (a reading aid: what stood AFTER the press and its pause). */
  trace?: () => string,
};

export type AutopilotResult = {
  /** `finished` — the server reached END and the finale was walked; `capped` — the press cap; `stuck` — nobody asked and nothing moved. */
  end: 'finished' | 'capped' | 'stuck',
  presses: number,
  generation: number,
  phase: string,
  /** Questions of the viewer that went away under the walk's own presses, by type (`or:menu` — an action taken on the menu). */
  byUi: Record<string, number>,
  /** Questions answered FOR the viewer after the budget of presses, by type. */
  byApi: Record<string, number>,
  /** The viewer's passes: by the wheel, and through the door when the gesture did not land. */
  passes: {ui: number, api: number},
  /** The other seats' answers. */
  seatMoves: number,
  /** The clock the game took (ms of the bottle's time). */
  tookMs: number,
  /** The soak's samples, one a generation (`AutopilotOptions.sample`): `{gen, …counts}`. */
  soak: Array<Record<string, number>>,
  /** WHERE THE SCREEN STOOD each time the door answered for the viewer: the question, the frames, the bar — what the walk parted from. */
  doors: Array<string>,
  log: Array<string>,
};

const ARROWS: ReadonlyArray<BottleKey> = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** The keys that open a LOOK (a viewer, the journal, a dossier) — a player reads it and closes it; a walk that is going somewhere seldom opens one. */
const LOOK_KEYS: ReadonlySet<BottleKey> = new Set<BottleKey>(['KeyX', 'KeyR', 'KeyC', 'KeyV']);

/**
 * The guided pick (`monkeyWalk.guidedPick`, with the pilot's own weights: it is going somewhere — A and RT carry a
 * flow on, B leaves it and a look only reads, so both are rare; and a look just opened is mostly closed by the next
 * press, as a player closes it).
 */
function pilotPick(bottle: ConsoleBottle, g: () => number, last: BottleKey | undefined, toTheQuestion: boolean = false): BottleKey {
  if (last !== undefined && LOOK_KEYS.has(last) && g() < 0.75) {
    return 'Escape';
  }
  const offered = bottle.offered();
  // THE PILOT IS ANSWERING (`toTheQuestion` — the second half of a question's budget, after its walk home): at the
  // board home it takes the way the home offers (A — the plate's «Открыть», «Вернуться к заседанию»), and on the
  // question's own screen it presses what carries a flow on and next to never what leaves or only reads. (The box's
  // whole games with the trail, 2026-11-24: at home the wandering pick chose the wheels four times of five, and the
  // door answered questions whose way back stood on the bar the whole time.)
  const sees = (selector: string): boolean => (globalThis as unknown as {window: {document: {querySelector(q: string): unknown}}}).window.document.querySelector(selector) !== null;
  // A LOOK STANDS OPEN (the fullscreen viewer — it covers the bar, whose words under it are another screen's): a
  // player reads it, turns a page or two, and CLOSES it. (The same games: X at the sitting's results, then eleven
  // presses of A inside the viewer while the bar under it read «A К исследованию» — and the door answered.)
  if (sees('dialog.con-zoom[open]')) {
    return toTheQuestion || g() < 0.5 ? 'Escape' : ARROWS[Math.floor(g() * ARROWS.length)];
  }
  if (toTheQuestion && offered.some((o) => o.key === 'Enter') && bottle.frames().length === 0 && !sees('.con-quick')) {
    return 'Enter';
  }
  const roll = g();
  if (roll < (toTheQuestion ? 0.8 : 0.7) && offered.length > 0) {
    const carries = (o: {key: BottleKey, hot: boolean}): number => (o.hot ? 8 : 0) + (o.key === 'Enter' ? 6 : o.key === 'Period' ? 4 : 0);
    const weight = (o: {key: BottleKey, hot: boolean}): number => (toTheQuestion ?
      (carries(o) > 0 ? carries(o) + 4 : LOOK_KEYS.has(o.key) || o.key === 'Escape' || o.key === 'Comma' || o.key === 'KeyY' ? 0.1 : 1) :
      (LOOK_KEYS.has(o.key) ? 0.5 : (o.hot ? 8 : 0) + (o.key === 'Enter' ? 6 : o.key === 'Period' ? 4 : o.key === 'Escape' ? 0.5 : 2)));
    let x = g() * offered.reduce((sum, o) => sum + weight(o), 0);
    for (const o of offered) {
      x -= weight(o);
      if (x < 0) {
        return o.key;
      }
    }
    return offered[0].key;
  }
  if (roll < 0.93) {
    return ARROWS[Math.floor(g() * ARROWS.length)];
  }
  return monkeyPick(g);
}

/**
 * Play the table the bottle stands on to its end. `seats` — the table's seats in order (the viewer is `bottle.seatId`).
 * The caller boots the bottle, and afterwards gives the page its last word and reads the journal — as after a walk.
 */
export async function autopilotGame(bottle: ConsoleBottle, seats: ReadonlyArray<{id: string}>, seed: string, options: AutopilotOptions = {}): Promise<AutopilotResult> {
  const server = bottleServer();
  const maxPresses = options.maxPresses ?? 4_000;
  const questionBudget = options.questionBudget ?? 45;
  const [menuMin, menuMax] = options.menuBudget ?? [4, 26];
  const passAtOnce = options.passAtOnce ?? 0.18;
  const stuckAfterMs = (options.stuckAfterS ?? 180) * 1000;
  const finalePresses = options.finalePresses ?? 40;
  const g = monkeyRng(`${seed}:pilot`);
  const seatRng = monkeyRng(`${seed}:seats`);
  const viewer = bottle.seatId;
  const others = seats.map((seat) => seat.id).filter((id) => id !== viewer);
  const startedAt = bottle.clock.now();
  const result: AutopilotResult = {
    end: 'capped', presses: 0, generation: 0, phase: '', byUi: {}, byApi: {}, passes: {ui: 0, api: 0}, seatMoves: 0, tookMs: 0, soak: [], doors: [], log: [],
  };
  const bump = (into: Record<string, number>, key: string): void => {
    into[key] = (into[key] ?? 0) + 1;
  };
  let lastKey: BottleKey | undefined;
  const press = async (key: BottleKey, pauseMs: number): Promise<void> => {
    const echo = await bottle.press(key);
    lastKey = key;
    result.presses++;
    await bottle.advance(pauseMs);
    result.log.push(`${key}:${echo}${options.trace === undefined ? '' : `{+${pauseMs} ${options.trace()}}`}`);
  };
  /** A player's rhythm, a little brisker than the monkey's: the pilot is playing, not poking. */
  const pause = (): number => {
    const roll = g();
    return Math.round(roll < 0.75 ? 150 + g() * 350 : roll < 0.97 ? 600 + g() * 1200 : 2500 + g() * 3000);
  };

  // The question the viewer stands on (the server's number), how it has been pressed at, and who answered it.
  let standing: {promptId: number | undefined, type: string, menu: boolean, presses: number, budget: number, byApi: boolean} | undefined;
  let quietSince = bottle.clock.now();
  let lastAge = -1;
  let sampledGeneration = 0;

  const othersMove = async (): Promise<void> => {
    for (const seat of others) {
      // (A seat may be asked again by its own answer — a card's follow-up; a few in a row, then the viewer's turn to look.)
      for (let i = 0; i < 6 && server.seatTruth(seat).waitingFor !== undefined; i++) {
        const moved = await server.seatAnswersRandomly(seat, seatRng());
        if (moved === undefined) {
          break;
        }
        result.seatMoves++;
        await bottle.clock.drain();
      }
    }
  };

  /** THE PASS, AS A PLAYER MAKES IT: the board home, the basic wheel (LT), its ↓ slot, the confirm. */
  const sees = (selector: string): boolean => (globalThis as unknown as {window: {document: {querySelector(q: string): unknown}}}).window.document.querySelector(selector) !== null;
  /**
   * THE BOARD HOME — every level between it and the pilot is left the way a player leaves it: B where the bar offers B
   * (a workspace, a look, a wheel), Y where the bar closes only by Y (the information screen's top). The home is the
   * screen whose bar offers the basic wheel and no way back (`orPass` — the pass slot in sight is home enough).
   */
  const walkHome = async (orPass: boolean): Promise<void> => {
    for (let i = 0; i < 10; i++) {
      const offered = bottle.offered();
      const offers = (key: BottleKey): boolean => offered.some((o) => o.key === key);
      if ((orPass && sees('.con-quick [data-quick-id="pass"]')) ||
          (bottle.frames().length === 0 && !sees('dialog.con-zoom[open]') && !sees('.con-quick') && offers('Comma') && !offers('Escape'))) {
        break;
      }
      await press(offers('Escape') || !offers('KeyY') ? 'Escape' : 'KeyY', 600);
    }
  };
  const passByWheel = async (promptId: number | undefined): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await walkHome(true);
      if (!sees('.con-quick [data-quick-id="pass"]')) {
        await press('Comma', 400);
        await bottle.until(() => sees('.con-quick [data-quick-id="pass"]'), 1_500, 100);
      }
      await press('ArrowDown', 400);
      await bottle.until(() => sees('.con-confirm'), 1_500, 100);
      await press('Enter', 800);
      if (await bottle.until(() => server.seatTruth(viewer).promptId !== promptId, 6_000, 250)) {
        return true;
      }
    }
    return false;
  };
  /** What stands on screen, in a line (the frames, the bar) — read BEFORE the door answers. */
  const standsNow = (): string => `frames ${bottle.frames().join('>') || 'none'} · bar «${bottle.bar().replace(/\s+/g, ' ').slice(0, 160)}»`;

  while (result.presses < maxPresses) {
    const truth = server.seatTruth(viewer);
    result.generation = truth.generation;
    result.phase = truth.phase;
    if (truth.phase === 'end') {
      break;
    }
    if (truth.gameAge !== lastAge) {
      lastAge = truth.gameAge;
      quietSince = bottle.clock.now();
    }
    await othersMove();
    // (The question's own model is read ONCE per question — a seat's whole view is the costliest thing the server builds.)
    const asked = truth.waitingFor === undefined ? undefined :
      standing !== undefined && standing.promptId === truth.promptId ? {type: standing.type, promptId: standing.promptId, menu: standing.menu} :
        await server.seatQuestion(viewer);
    if (asked === undefined) {
      // NOBODY ASKS THE VIEWER: another seat's turn, the bot's timer, a scene of the page's own. The clock moves it —
      // and a press may be owed all the same (a reveal's take, a plate, a result's acknowledge): the pilot looks on.
      if (standing !== undefined) {
        bump(standing.byApi ? result.byApi : result.byUi, standing.menu ? 'or:menu' : standing.type);
        standing = undefined;
      }
      if (bottle.clock.now() - quietSince > stuckAfterMs && others.every((seat) => server.seatTruth(seat).waitingFor === undefined)) {
        result.end = 'stuck';
        result.log.push(`[STUCK gen ${truth.generation} ${truth.phase}]`);
        break;
      }
      if (g() < 0.5) {
        await press(pilotPick(bottle, g, lastKey), 400 + Math.round(g() * 600));
      } else {
        await bottle.advance(900);
      }
      continue;
    }
    quietSince = bottle.clock.now();
    if (options.sample !== undefined && asked.menu && sampledGeneration !== truth.generation && bottle.frames().length === 0) {
      sampledGeneration = truth.generation;
      result.soak.push({gen: truth.generation, ...options.sample()});
    }
    if (standing === undefined || standing.promptId !== asked.promptId) {
      if (standing !== undefined) {
        bump(standing.byApi ? result.byApi : result.byUi, standing.menu ? 'or:menu' : standing.type);
      }
      const budget = asked.menu ? (g() < passAtOnce ? 0 : menuMin + Math.floor(g() * (menuMax - menuMin + 1))) : questionBudget;
      standing = {promptId: asked.promptId, type: asked.type, menu: asked.menu, presses: 0, budget, byApi: false};
    }
    if (standing.presses >= standing.budget) {
      if (standing.menu) {
        // THE TURN ENDS: by the wheel — and through the door when the gesture did not land (counted apart).
        const stood = standsNow();
        const landed = await passByWheel(asked.promptId);
        if (!landed) {
          options.onDoor?.(`pass · gen ${truth.generation}`);
        }
        if (landed) {
          result.passes.ui++;
          result.log.push('[PASS]');
          // (The menu went by the pilot's own pass, not by an action: it is no row of `byUi`.)
          standing = undefined;
        } else {
          const moved = await server.otherSeatMoves(viewer);
          await bottle.clock.drain();
          result.passes.api++;
          result.log.push(`[PASS-BY-DOOR ${moved?.did ?? 'nothing'}]`);
          result.doors.push(`pass · gen ${truth.generation} · ${stood} → after the gesture: ${standsNow()}`);
          standing = undefined;
          await bottle.advance(1_500);
        }
      } else {
        result.doors.push(`${asked.type} · gen ${truth.generation} · ${standsNow()}`);
        options.onDoor?.(`${asked.type} · gen ${truth.generation}`);
        // (A question that is not the menu is never «passed»: the answer the door gives is a move, as the screen's would be.)
        const moved = await server.seatAnswersRandomly(viewer, seatRng(), 0);
        await bottle.clock.drain();
        standing.byApi = true;
        result.log.push(`[BY-DOOR ${asked.type}${moved === undefined ? ' nothing' : ''}]`);
        // (The page learns of it as of any answer given elsewhere: by the wake, or its poll.)
        await bottle.advance(1_500);
      }
      continue;
    }
    standing.presses++;
    // HALF THE QUESTION's BUDGET SPENT AND IT STILL STANDS: a player asked something the screen in front of them does
    // not answer GOES HOME — the board, where the question's plate or its way back stands. (The passes of
    // 2026-11-24: the pilot browsed the Parliament's delegate stage for four questions in a row, and the door
    // answered each — a row of «where the door answered» that named a habit of the pilot, never a place of the
    // product. What the door answers after this walk is a question the HOME could not serve either.)
    if (!standing.menu && standing.presses === Math.floor(standing.budget / 2)) {
      await walkHome(false);
    }
    await press(pilotPick(bottle, g, lastKey, !standing.menu && standing.presses >= Math.floor(standing.budget / 2)), pause());
  }

  if (result.phase === 'end') {
    // THE FINALE: the ceremony's screens are the page's own — pressed through like everything else.
    for (let i = 0; i < finalePresses && result.presses < maxPresses + finalePresses; i++) {
      await press(pilotPick(bottle, g, lastKey), 700 + Math.round(g() * 1_300));
    }
    result.end = 'finished';
  }
  const last = server.seatTruth(viewer);
  result.generation = last.generation;
  result.phase = last.phase;
  result.tookMs = bottle.clock.now() - startedAt;
  return result;
}
