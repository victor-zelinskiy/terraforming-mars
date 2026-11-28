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
import {createDoorRun} from '../../testing/autopilotDoor';

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
  onDoor?: (what: string, lastPresses: ReadonlyArray<string>) => void,
  /**
   * THE SOAK's SAMPLE (stage 6 — «flat over a whole game»): called ONCE A GENERATION, at the same place every time —
   * the viewer's action menu with nothing on the stack (the board home) — so what it counts (DOM nodes, the kernel's
   * scopes and waits, armed timers, the heap) is comparable from generation to generation. A page that leaks grows.
   */
  sample?: () => Record<string, number>,
  /** A word about the page appended to every press of the log (a reading aid: what stood AFTER the press and its pause). */
  trace?: () => string,
  /**
   * THE CARDS THE GAME IS FOR (stage 6, total coverage — the browser pilot's `dealt`): the deal's projects, or a
   * scenario's targets. On the action menu the pilot goes to the hand when one of them stands in it, and walks the
   * album's cursor to a playable one.
   */
  targets?: ReadonlyArray<string>,
  /** …and every card the opening deals the game for (its corporation, its preludes, its projects): the start's steps take them. */
  startTargets?: ReadonlyArray<string>,
};

export type AutopilotResult = {
  /** `finished` — the server reached END and the finale was walked; `capped` — the press cap; `stuck` — nobody asked and nothing moved. */
  end: 'finished' | 'capped' | 'stuck',
  /** Why the game is `stuck` when it was the SCREEN that stood — the door's run under one screen (`autopilotDoor.ts`) — and not the table. */
  stuckWhy?: string,
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
/** The presses one question may spend WAITING a flow's own beat out (a committed frame offering neither A nor RT). */
const WAIT_PRESSES_MAX = 120;
/** The least a menu stands with a target playable in the hand: the wheel, the album's walk (16 at most), A, the composer. */
const TARGET_MENU_PRESSES = 45;

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
  // …AND EVERY OTHER LOOK OF THE PLAYER's OWN (the browser pilot's rule — CI's bottle on `4d74b4f9a0`: the door over
  // «Information · X Inspect · B Back · Y Close» standing on the draft, B only walking back inside the screen): the
  // information screen closes by Y, the journal and the «Played» table by B. Answering, at once; wandering, now and then.
  if (sees('.con-info') && (toTheQuestion || g() < 0.35)) {
    return 'KeyY';
  }
  if ((sees('.con-journal') || sees('.con-played:not(.con-played--hero):not(.con-played--embedded)')) && (toTheQuestion || g() < 0.35)) {
    return 'Escape';
  }
  // (…the board home, never a STANDALONE question's own host: with no frame it looked like home, and A — which on a
  // distribution only adds a unit — was pressed to the end of the budget while its commit stood on X: bottle game 1188,
  // three questions answered by the door. On a host the weighted pick below carries the flow on, X included.)
  const onTaskHost = sees('.con-task-host');
  if (toTheQuestion && offered.some((o) => o.key === 'Enter') && bottle.frames().length === 0 && !sees('.con-quick') && !onTaskHost) {
    return 'Enter';
  }
  const roll = g();
  // A LOOK JUST CLOSED IS NOT OPENED AGAIN AT ONCE (the bottle on the scenario of the Parliament, 2026-11-27: at the
  // sitting's verdict «X Осмотреть» opened a corporation's look, B closed it to a level that offered X again, and the
  // thumb walked X · B · X · B to the end of the question's budget — «A К исследованию» one B further up; the door
  // answered). After B, a player goes on — up, along, or with the flow — never straight back into the look.
  const reopens = (o: {key: BottleKey}): boolean => last === 'Escape' && LOOK_KEYS.has(o.key);
  if (roll < (toTheQuestion ? 0.8 : 0.7) && offered.length > 0) {
    const carries = (o: {key: BottleKey, hot: boolean}): number => (o.hot ? 8 : 0) + (o.key === 'Enter' ? 6 : o.key === 'Period' ? 4 : 0);
    const weight = (o: {key: BottleKey, hot: boolean}): number => reopens(o) ? 0 : (toTheQuestion ?
      (carries(o) > 0 ? carries(o) + 4 : o.key === 'KeyX' ? (onTaskHost ? 8 : 2) : LOOK_KEYS.has(o.key) || o.key === 'Escape' || o.key === 'Comma' || o.key === 'KeyY' ? 0.1 : 1) :
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
  // THE DOOR UNDER ONE SCREEN (`tests/testing/autopilotDoor.ts` — stage M: a screen the door has to answer for again and
  // again, with not one answer on the screen in between, cannot be answered — the game ends `stuck` there, the screen
  // named, instead of playing on behind it). Asked right after a door's row is written.
  const doorRun = createDoorRun();
  const doorStood = (): boolean => {
    const why = doorRun.door(result.doors[result.doors.length - 1] ?? '');
    if (why === undefined) {
      return false;
    }
    result.end = 'stuck';
    result.stuckWhy = why;
    result.log.push(`[STUCK-BY-DOOR ${why}]`);
    return true;
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
  let standing: {promptId: number | undefined, type: string, menu: boolean, presses: number, budget: number, byApi: boolean, waited: number,
    handVisits: number, handTarget?: string, handSteps: number, startTargetTries: number} | undefined;
  const targets = new Set(options.targets ?? []);
  const startTargets = new Set(options.startTargets ?? options.targets ?? []);
  let quietSince = bottle.clock.now();
  let lastAge = -1;
  let sampledGeneration = 0;
  /** The start's last press gave a card back (see «THE START SCENE»). */
  let startTrimmed = false;

  const othersMove = async (): Promise<void> => {
    for (const seat of others) {
      // (A seat may be asked again by its own answer — a card's follow-up; a few in a row, then the viewer's turn to look.)
      for (let i = 0; i < 6 && server.seatTruth(seat).waitingFor !== undefined; i++) {
        // (A SEAT THAT CAN TERRAFORM MOSTLY DOES — `seatTerraforms`: the two-seat scenario tables ran fifty generations.)
        if (seatRng() < 0.7 && await server.seatTerraforms(seat, seatRng()) !== undefined) {
          result.seatMoves++;
          await bottle.clock.drain();
          continue;
        }
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
  /** A command the bar shows GREY (its glyph's label, «RT») — the commit still to come. */
  const barGreys = (glyph: string): boolean => [...(globalThis as unknown as {window: {document: {querySelectorAll(q: string): Iterable<{textContent: string | null}>}}})
    .window.document.querySelectorAll('.con-cmdbar__cmd--disabled .gp-glyph')].some((el) => (el.textContent ?? '').trim() === glyph);
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
  const passByWheel = async (promptId: number | undefined): Promise<boolean | 'resumed'> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await walkHome(true);
      if (!sees('.con-quick [data-quick-id="pass"]')) {
        await press('Comma', 400);
        await bottle.until(() => sees('.con-quick [data-quick-id="pass"]'), 1_500, 100);
      }
      // THE TURN's SECOND ACTION ENDS BY «ПРОПУСТИТЬ ХОД», never by the pass (the rules: a pass is the turn's FIRST
      // action — the bottle's scenario of the cities, game 41: the menus that played the game's cards ran into the
      // second action, the pilot read the grey pass as an unfinished action and the door passed). The wheel's up slot
      // ends the turn at once — no confirm.
      if (sees('.con-quick [data-quick-id="pass"].con-quick__slot--disabled') &&
          sees('.con-quick [data-quick-id="skipTurn"]:not(.con-quick__slot--disabled)')) {
        await press('ArrowUp', 800);
        if (await bottle.until(() => server.seatTruth(viewer).promptId !== promptId, 6_000, 250)) {
          return true;
        }
        continue;
      }
      // THE PASS IS NOT OPEN YET — an action of the player's own stands unfinished (CI's bottle on `4d74b4f9a0`, game
      // 558: the opening minimized with Industrialists Campaign's rally still owed to it, the wheel's slots «Finish your
      // current action first»; the gesture could not land and the door passed). A player closes the wheel and goes back
      // to what is unfinished: the home's plate, its A.
      if (sees('.con-quick [data-quick-id="pass"].con-quick__slot--disabled')) {
        await press('Escape', 400);
        await walkHome(false);
        if (bottle.offered().some((o) => o.key === 'Enter')) {
          await press('Enter', 800);
          return 'resumed';
        }
        return false;
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
  /**
   * THE HAND's ALBUM as it stands — by its own structure (a card's page, its row, its place in the row), never a rect:
   * the browser pilot's probe (`console-autopilot.spec.ts` — `seen.hand`), read off the bottle's document.
   */
  type AlbumCard = {name: string, playable: boolean, page: number, row: number, col: number};
  const album = (): {focused: number, cards: Array<AlbumCard>} | undefined => {
    type El = {classList: {contains(c: string): boolean}, getAttribute(a: string): string | null, closest(q: string): El | null,
      parentElement: El | null, querySelectorAll(q: string): Iterable<El>};
    const doc = (globalThis as unknown as {window: {document: {querySelectorAll(q: string): Iterable<El>}}}).window.document;
    const slots = [...doc.querySelectorAll('.con-hand__slot')];
    if (slots.length === 0 || !slots.some((el) => el.classList.contains('con-hand__slot--playable') || el.classList.contains('con-hand__slot--unplayable') ||
        el.classList.contains('con-hand__slot--notnow'))) {
      return undefined;
    }
    const index = (el: El | null, of: El | null | undefined, selector: string): number =>
      el === null || of === null || of === undefined ? -1 : [...of.querySelectorAll(`:scope > ${selector}`)].indexOf(el);
    return {
      focused: slots.findIndex((el) => el.classList.contains('con-hand__slot--selected')),
      cards: slots.map((el) => {
        const row = el.closest('.con-hand__row');
        const page = el.closest('.con-hand__page');
        return {name: el.getAttribute('data-zoom-slot') ?? '', playable: el.classList.contains('con-hand__slot--playable'),
          page: index(page, page?.parentElement, '.con-hand__page'), row: index(row, page, '.con-hand__row'), col: index(el, row, '.con-hand__slot')};
      }),
    };
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
        if (!standing.byApi) {
          doorRun.answeredOnScreen();
        }
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
        if (!standing.byApi) {
          doorRun.answeredOnScreen();
        }
      }
      // (The opening is the whole start — a corporation, the preludes, a buy, the summary: four steps' presses, never one
      // question's.)
      // (THE CARD THE GAME IS FOR IS NOT PASSED BY — the cards axis' scenarios, a family of cards whose requirement
      // the sitting or the generation closes: the menus went by at once or on a budget shorter than the way to the
      // card, and the window shut on half the hand. A menu with a target playable in the hand stands at least the way
      // to it — the wheel, the album's walk, A — and its composer's steps.)
      const owed = asked.menu && targets.size > 0 && (bottle.view()?.cardsInHand ?? []).some((c) => targets.has(c.name) && c.isDisabled !== true);
      const onMenu = asked.menu ? (g() < passAtOnce ? 0 : menuMin + Math.floor(g() * (menuMax - menuMin + 1))) : 0;
      const budget = asked.menu ? (owed ? Math.max(TARGET_MENU_PRESSES, onMenu) : onMenu) :
        asked.type === 'initialCards' ? questionBudget * 4 : questionBudget;
      standing = {promptId: asked.promptId, type: asked.type, menu: asked.menu, presses: 0, budget, byApi: false, waited: 0, handVisits: 0, handSteps: 0, startTargetTries: 0};
    }
    if (standing.presses >= standing.budget) {
      if (standing.menu) {
        // THE TURN ENDS: by the wheel — and through the door when the gesture did not land (counted apart).
        const stood = standsNow();
        const landed = await passByWheel(asked.promptId);
        if (landed === 'resumed') {
          // (…back into the unfinished action: the turn's question stands again, with a fresh budget, once it is done.)
          result.log.push('[WAY-BACK]');
          standing = undefined;
          continue;
        }
        if (!landed) {
          options.onDoor?.(`pass · gen ${truth.generation}`, result.log.slice(-30));
        }
        if (landed) {
          result.passes.ui++;
          doorRun.answeredOnScreen();
          result.log.push('[PASS]');
          // (The menu went by the pilot's own pass, not by an action: it is no row of `byUi`.)
          standing = undefined;
        } else {
          const moved = await server.otherSeatMoves(viewer);
          await bottle.clock.drain();
          result.passes.api++;
          result.log.push(`[PASS-BY-DOOR ${moved?.did ?? 'nothing'}]`);
          result.doors.push(`pass · gen ${truth.generation} · ${stood} → after the gesture: ${standsNow()}`);
          if (doorStood()) {
            break;
          }
          standing = undefined;
          await bottle.advance(1_500);
        }
      } else {
        result.doors.push(`${asked.type} · gen ${truth.generation} · ${standsNow()}`);
        options.onDoor?.(`${asked.type} · gen ${truth.generation}`, result.log.slice(-30));
        if (doorStood()) {
          break;
        }
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
    // A FLOW PRESENTING ITS OWN BEAT IS WAITED OUT, never spent (CI's bottle on `ea409111c3`, games 2 and 18: a sitting
    // past its commit, the bar «X Осмотреть · B Свернуть» and no A while its renewal played — the pilot's presses there
    // used the question's whole budget, and the door answered the «К драфту» that rose a moment later). A press over a
    // committed frame whose bar offers neither A nor RT is a player waiting; such waits are counted apart, bounded.
    const top = bottle.frames()[bottle.frames().length - 1] ?? '';
    const waiting = /:(committed|executing|completing|verdict)/.test(top) && !bottle.offered().some((o) => o.key === 'Enter' || o.key === 'Period');
    if (waiting && standing.waited < WAIT_PRESSES_MAX) {
      standing.waited++;
    } else {
      standing.presses++;
    }
    // HALF THE QUESTION's BUDGET SPENT AND IT STILL STANDS: a player asked something the screen in front of them does
    // not answer GOES HOME — the board, where the question's plate or its way back stands. (The passes of
    // 2026-11-24: the pilot browsed the Parliament's delegate stage for four questions in a row, and the door
    // answered each — a row of «where the door answered» that named a habit of the pilot, never a place of the
    // product. What the door answers after this walk is a question the HOME could not serve either.)
    if (!standing.menu && standing.type !== 'initialCards' && standing.presses === Math.floor(standing.budget / 2)) {
      await walkHome(false);
    }
    // THE START SCENE, WALKED AS A PLAYER WALKS IT (the browser pilot's rule — the bottle's games gave the opening to
    // the door every time, `by the door: initialCards 1`): a card under the cursor not yet taken is taken, a taken one
    // passed by or the step done (RT, lit), a lone verb pressed (the summary's launch, «Skip»); never LT nor B.
    if (asked.type === 'initialCards' && /^start:/.test(bottle.frames()[bottle.frames().length - 1] ?? '')) {
      // THE CARDS THE GAME IS FOR ARE BOUGHT FIRST (stage 6, the cards axis — the `missing` deal: the projects step's RT
      // is lit at zero cards, and the walk below took one card, advanced, and the dealt cards never reached the hand:
      // one card played in twenty-four generations). On the projects step, a target not yet taken is walked to and taken
      // — the walk below goes on once every target stands taken (or the purse refuses the next).
      const doc = (globalThis as unknown as {window: {document: {querySelector(q: string): {getAttribute(a: string): string | null} | null,
        querySelectorAll(q: string): Iterable<{getAttribute(a: string): string | null, classList: {contains(c: string): boolean}}>}}}).window.document;
      // (…on every step of the opening that deals a card: the corporation, the preludes, the projects.)
      const focusedSlot = doc.querySelector('.con-start .con-cards__slot--focused[data-step-slot]')?.getAttribute('data-step-slot') ?? '';
      const step = focusedSlot.split('|')[0];
      if (focusedSlot !== '' && startTargets.size > 0 && (step === 'projects' || step === 'corp' || step === 'prelude')) {
        const slots = [...doc.querySelectorAll(`.con-start .con-cards__slot[data-step-slot^="${step}|"]`)]
          .map((el) => ({name: (el.getAttribute('data-step-slot') ?? '').slice(step.length + 1), picked: el.classList.contains('con-cards__slot--picked')}));
        const owed = slots.filter((s) => startTargets.has(s.name) && !s.picked);
        const here = slots.find((s) => `${step}|${s.name}` === focusedSlot);
        if (owed.length > 0 && standing.startTargetTries < 40) {
          standing.startTargetTries++;
          await press(here !== undefined && startTargets.has(here.name) && !here.picked ? 'Enter' : 'ArrowRight', pause());
          continue;
        }
      }
      const offered = bottle.offered();
      const label = (key: BottleKey): string => offered.find((o) => o.key === key)?.label ?? '';
      const nextLit = offered.some((o) => o.key === 'Period');
      const a = label('Enter');
      // (…a taken card with the step's RT not lit — a buy over the purse, a pick over its count: one card given back
      // now and then, as a player trims the pile; the bottle's games picked every card and stood without an RT.)
      // (…and a card just given back is passed by, never taken again at once: a step that wants EXACTLY two stands without
      // its RT at one card taken as much as at all of them.)
      const taken = /^(Unpick|Deselect|Unselect)$/.test(a);
      // (A step's row ends — a → that does not move is answered by ← or a row away.)
      const roll = g();
      const move: BottleKey = roll < 0.55 ? 'ArrowRight' : roll < 0.85 ? 'ArrowLeft' : roll < 0.93 ? 'ArrowDown' : 'ArrowUp';
      const key: BottleKey = taken ? (nextLit ? (g() < 0.6 ? 'Period' : move) : (g() < 0.2 ? 'Enter' : move)) :
        /^(Select|Choose|Pick)$/.test(a) ? (startTrimmed ? move : 'Enter') : nextLit ? 'Period' : a !== '' ? 'Enter' : move;
      startTrimmed = taken && key === 'Enter';
      await press(key, pause());
      continue;
    }
    // THE CARD A TURN PLAYS (stage 6, total coverage — the browser pilot's rule, now the bottle's too: the bottle's games
    // of a scenario played its hand by chance, and the flows the scenario stands on stayed unopened — the Parliament's
    // walk, rally, sanctions, the staged vote). On the action menu, with a target in the hand: home → the quick wheel's
    // centre (the hand), and in the album the cursor walks to a playable target (a page, a row, along it) and A plays
    // it — the composer and its steps are the pilot's as for any card. Twice a menu at most; a target not reached in
    // sixteen steps is let go.
    if (standing.menu && targets.size > 0 && !sees('dialog.con-zoom[open]')) {
      const top = bottle.frames()[bottle.frames().length - 1] ?? '';
      const hand = album();
      if (/^hand:browse/.test(top) && hand !== undefined && hand.focused >= 0) {
        const order = [...targets];
        const playable = hand.cards.filter((c) => c.playable && targets.has(c.name)).map((c) => c.name).sort((x, y) => order.indexOf(x) - order.indexOf(y));
        if (standing.handTarget === undefined || (standing.handTarget !== '' && !playable.includes(standing.handTarget))) {
          standing.handTarget = playable[0] ?? '';
          standing.handSteps = 0;
          if (standing.handTarget !== '') {
            result.log.push(`[HAND ${standing.handTarget}]`);
          }
        }
        const at = standing.handTarget === '' ? -1 : hand.cards.findIndex((c) => c.name === standing?.handTarget);
        if (at >= 0 && ++standing.handSteps <= 16) {
          const [from, to] = [hand.cards[hand.focused], hand.cards[at]];
          await press(to.page !== from.page ? (to.page > from.page ? 'ArrowRight' : 'ArrowLeft') :
            to.row !== from.row ? (to.row > from.row ? 'ArrowDown' : 'ArrowUp') :
              to.col !== from.col ? (to.col > from.col ? 'ArrowRight' : 'ArrowLeft') : 'Enter', pause());
          continue;
        }
      } else if (standing.handVisits < 2 && bottle.frames().length === 0 && !sees('.con-quick') &&
          (bottle.view()?.cardsInHand ?? []).some((c) => targets.has(c.name) && c.isDisabled !== true)) {
        standing.handVisits++;
        standing.handTarget = undefined;
        result.log.push('[TO THE HAND]');
        await press('Period', 400);
        await bottle.until(() => sees('.con-quick'), 1_500, 100);
        await press('Enter', 1_200);
        continue;
      }
    }
    // A PICK OF CARDS THAT COMMITS BY RT (the browser pilot's rule — CI's bottle on `1c0976df77`, game 521: «Корпоративные
    // архивы», keep two of seven, the commit standing GREY until exactly two were taken; the thumb toggled cards on and
    // off until the door answered). Once the question has stood a third of its budget: the lit commit is pressed, an
    // untaken card under the cursor taken, a taken one walked past — a player reading the grey RT as the commit to come.
    // (…the PICK's RT only: on a screen of no frame RT is the quick wheel — «RT Действия» at the board home, where the
    // question's way is the plate's A; the colonies' scenario on the bottle pressed the wheel open over a colony bonus's
    // «A Открыть» until the door answered.)
    const offeredNow = bottle.offered();
    const aNow = offeredNow.find((o) => o.key === 'Enter')?.label ?? '';
    const rtCommits = offeredNow.some((o) => o.key === 'Period' && !/^Actions/.test(o.label));
    if (asked.type === 'card' && !standing.menu && standing.presses >= Math.floor(standing.budget / 3) && bottle.frames().length > 0 &&
        !sees('dialog.con-zoom[open]') && !sees('.con-quick') && (rtCommits || barGreys('RT')) && aNow !== '') {
      // (…the card under the cursor READ as a player reads it — its slot taken (the hand's «✓», a slot's band) or refused —
      // never off A's label: a multi pick's A reads «Select / Deselect» whatever stands under it, and the thumb took one
      // card on and off until the door answered (the Reds' «discard 2», CI's bottle on `4d74b4f9a0`, game 538).)
      const focusTaken = sees('.con-hand__slot--selected.con-hand__slot--select-picked, .con-hand__slot--selected.con-hand__slot--select-disabled, ' +
        '.con-cards__slot--focused.con-cards__slot--picked');
      const key: BottleKey = rtCommits ? 'Period' :
        !focusTaken && !/^(Unpick|Deselect|Unselect)/.test(aNow) ? 'Enter' : (['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const)[standing.presses % 4];
      await press(key, pause());
      continue;
    }
    // A SPREAD OVER CARDS (CI's bottle on `4d74b4f9a0`, game 538 replayed — «Place 4 floaters on your cards», a
    // resolution's effect inside the sitting: «LB/RB Distribute −1 / +1 · A Save», A grey until the four are placed, and
    // the thumb pressed A and the bumpers at random until the door answered): what is left onto the focused card (RT
    // «Rest here» — the narrow bar drops its hint, never its key), +1 where it fits, the next card — and A once it is lit.
    // (…and EVERY layout that steps by LB / RB — a payment's lanes «LB −1 · RB +1 · X Pay», a split of resources «LB/RB
    // Distribute · X Collect» (CI's bottle on `1d740f2ea5`, two doors): the commit is whichever verb is lit — A, or X
    // when X is the layout's own answer (Pay · Collect · Save · Confirm), never X «Inspect».)
    // (…and «Apply» — the hazard thresholds of Butterfly Effect, `aresGlobalParameters`: «LB −1 · RB +1 · X Apply», the
    // bottle's game 11 of the night pass stepped the stick over it until the door applied them.)
    const commitX = offeredNow.some((o) => o.key === 'KeyX' && /^(Pay|Collect|Save|Confirm|Take|Accept|Apply)/.test(o.label));
    if ((/Distribute\s*−1\s*\/\s*\+1/.test(bottle.bar()) || /LB\s*−1\s*RB\s*\+1/.test(bottle.bar().replace(/\s+/g, ' '))) &&
        !sees('dialog.con-zoom[open]') && !sees('.con-quick')) {
      const key: BottleKey = offeredNow.some((o) => o.key === 'Enter') ? 'Enter' : commitX ? 'KeyX' : (['Period', 'KeyE', 'ArrowDown'] as const)[standing.presses % 3];
      await press(key, pause());
      continue;
    }
    // THE LAYOUT OF A LOSS (the browser pilot's rule — CI's bottle on `4d74b4f9a0`: the door on «Board · A −1 · X Accept
    // the loss · B Minimize»): a unit off the focused row, another, the next row, and «Accept the loss».
    if (asked.type === 'productionToLose' && sees('.con-prodloss') && !sees('dialog.con-zoom[open]') && !sees('.con-quick')) {
      await press((['Enter', 'Enter', 'ArrowDown', 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // THE DISTRIBUTION OF RESOURCES (the browser pilot's rule — the bottle's Philares, games 7 and 13: «Gain 1 standard
    // resource», A placed the unit and took it back until the door answered): a unit onto the focused row (RB where the
    // layout steps by LB / RB, A where A adds), the next row, another — and X, the take.
    if (asked.type === 'resources' && bottle.frames().length === 0 && !sees('dialog.con-zoom[open]') && !sees('.con-quick') &&
        bottle.bar().replace(/\s+/g, ' ').trim().startsWith('Distribute resources')) {
      const add: BottleKey = offeredNow.some((o) => o.key === 'KeyE') ? 'KeyE' : 'Enter';
      await press(([add, 'ArrowDown', add, 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // A CELL PICK WHOSE «A» IS GREY UNDER THE ALL-CELLS LOOK (the browser pilot's rule — CI's autopilot on `6ba4e117ff`,
    // game 540: the pilot's own R3 widened the board, the cursor stood on a cell the tile cannot take, the arrows walked
    // the board until the door answered): R3 «Available only» narrows it back, and the cursor lands on the nearest.
    if (asked.type === 'space' && bottle.frames().length === 0 && !sees('dialog.con-zoom[open]') && !sees('.con-quick') &&
        barGreys('A') && offeredNow.some((o) => o.key === 'KeyV' && o.label === 'Available only')) {
      result.log.push('[LEGAL-CELLS]');
      await press('KeyV', pause());
      continue;
    }
    await press(pilotPick(bottle, g, lastKey, !standing.menu && standing.presses >= Math.floor(standing.budget / 2)), pause());
  }

  if (result.phase === 'end') {
    // THE FINALE: the ceremony's screens are the page's own — pressed through like everything else.
    for (let i = 0; i < finalePresses && result.presses < maxPresses + finalePresses; i++) {
      // THE PAGE IS LEAVING (the loading curtain: «to the menu», a rematch — a full reload in a browser): the game's
      // page ends here. The bottle has no navigation — its curtain would stand for good, absorb the presses that
      // follow, and the arbiter would rightly call THAT a deaf screen (the gated pass on CI, 45370636119 — game 14).
      if (sees('.con-load')) {
        break;
      }
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
