import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import {answerPrompt, cinematicBeat, fetchPlayerModel, NO_PAYMENT, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig} from './consoleStart';

/**
 * THE AUTOPILOT — A WHOLE GAME THROUGH THE REAL CONSOLE, IN A REAL BROWSER (FREEZE ZERO, stage 6 — «whole games and
 * time»; docs/claude/console/freeze-zero/PLAN.md § 8).
 *
 * The monkey walks sixty presses from a fixture and never ends a game. This plays one: a table the product's own
 * creator makes (`/api/creategame` — the solo player against MarsBot, the fork's main mode; one game in four without
 * the bot), from the first turn to the final scoring, the viewer's seat THROUGH THE PAD. (The OPENING is answered over
 * the API before the page opens — `seedGameOverApi`, the drivers' own seeder: a pilot that answers the start's
 * questions through another door while the scene stands makes states only a second device makes, and the start
 * director's cure of them is red by contract — two of the first sixteen games. The opening has its own specs, and the
 * bottle's pilot walks it.) The game itself:
 *   · it presses what the command bar OFFERS (the hot verb first, A and RT before B, a look seldom and closed by the
 *     next press), some cursor moves, a few presses of anything;
 *   · on its action menu it plays for a seeded while and then PASSES as a player does — the basic wheel's ↓ and its
 *     confirm; MarsBot plays on the server's own clock;
 *   · a question the walk did not get through in its budget of presses is answered over the API, as another device of
 *     the same seat would (`answerPrompt` — the drivers' own answerer), and COUNTED with what stood on screen: where
 *     the screen and a seeded thumb part. A statistic of the walk, never a defect by itself.
 * What judges the page is what judges every e2e test: the harness's guards (a stall nobody cured, a heal that had to
 * run, a Vue error, a page that died) and the cause classes the page named, filed beside the game's own numbers
 * (`cause-classes/…json` — `scripts/monkey-report.mjs` sums a pass of games as it sums a pass of walks).
 *
 * The same pilot plays in the bottle on a manual clock (`tests/client/bottle/autopilot.ts`) — minutes of a laptop, and
 * blind wherever a rect or a CSS clock is needed; this one is the real page, in real time: a game is ten to twenty
 * minutes of a runner.
 *
 * THE SOAK (`TM_E2E_AUTOPILOT_IDLE_MIN=<minutes>` — the stage's «hours of one page»): the same game, and at every
 * generation's sample point — the viewer's action menu with nothing on the stack — THE PAGE IS LEFT ALONE for that
 * long, the console on a TV nobody is pressing. Around each such spell the browser itself is asked (CDP, after a
 * collection of garbage): the heap, the DOM's nodes, the listeners; and over the spell: the layouts and the style
 * recalculations the idle page did, its seconds of script, the long frames it named and every warning it raised.
 * A page that leaks grows from spell to spell with nobody touching it; a page that is not at rest keeps laying out.
 * A game enters and leaves by a full reload (`App.vue` — «a fresh page guarantees clean per-game module state»), so
 * one page's hours ARE one game's.
 *
 * THE PILOT GOES SOMEWHERE (stage 6 deepened, 2026-11-25 — the owner: «прогнать реально ВСЕ возможные кейсы»). The
 * first two hundreds were a seeded thumb on whatever the bar offered: their kernel report read 180 of 285 flows opened
 * — no colony ever built, no party action, the Hydronetwork a rarity — and 23 answers through the door, most of them a
 * pilot standing in a look of its own. So, in `TM_E2E_AUTOPILOT_PILOT=2` (the default; `1` is the first pilot, kept
 * for a pass that must be compared with an old one):
 *   · A TURN HAS AN INTENT: on most of its action menus the pilot goes to ONE section by the wheel that leads there
 *     (the hand, the card actions, the trade, the Parliament, the Hydronetwork, the standard projects, a conversion)
 *     — the sections in rotation, so a game visits them all — and inside it presses what CARRIES a flow on;
 *   · A LOOK IS CLOSED BEFORE AN ANSWER: the information screen, the journal, the «Разыграно» table and the viewer
 *     are the pilot's own, and a pilot that is answering leaves them first (the doors of the second hundred);
 *   · THE LAYOUT OF A LOSS HAS ITS HANDS: «A −1 · X Принять убыток» is walked as a player lays it out.
 * The door's answers and the kernel's «never opened» are the measure of it, pass against pass.
 *
 * PILOT 3 (the default since 2026-11-25; `2` keeps the one before for a pass that must be compared). Pilot 2's first
 * twenty games answered 1 201 questions on the screen and four through the door — and every one of the four was a
 * layout the pilot had no hands for, never a place of the product:
 *   · THE DISTRIBUTION OF RESOURCES («A Добавить / Снять · X Забрать»): a unit onto the focused row, the next row,
 *     and the take — as a player lays it out (three of the four doors);
 *   · A PICK OF CARDS THAT COMMITS BY RT («A Выбрать / снять · RT Сбросить N»): a card, the commit, the next card —
 *     a thumb that toggled the same card on and off never reached the count.
 *
 * OPT-IN: `TM_E2E_AUTOPILOT=1 npx playwright test tests/e2e/console-autopilot.spec.ts` · `TM_E2E_AUTOPILOT_GAMES`
 * (`<from>-<to>` or a list; default `1-2`) · `TM_E2E_AUTOPILOT_NAME` (the stream's name, default `ap0`) ·
 * `TM_E2E_AUTOPILOT_PRESSES` (the cap, default 3200 — see `PRESSES`).
 */
const ENABLED = process.env.TM_E2E_AUTOPILOT === '1';
if (ENABLED) {
  process.env.TM_E2E_COVERAGE ??= '1';
}
const NAME = process.env.TM_E2E_AUTOPILOT_NAME ?? 'ap0';
/**
 * THE PRESS BUDGET of one game — a TIME bound, never the loop catcher (a table nobody moves for ten minutes is `stuck`).
 * A «capped» game must mean a pilot that walked in circles, not a long table: duo tables with Venus reach 1 700 – 1 900
 * presses to their final scoring, and one stood capped at 2 000 in generation 21 (the box's sixth count, game 1645 —
 * 23 minutes). 3 200 is ≈ 37 minutes at that pace, under the test's own 75.
 */
const PRESSES = Number(process.env.TM_E2E_AUTOPILOT_PRESSES ?? 3200);
/** WHICH PILOT walks (`3` — with hands for every layout met so far; `2` — the one that goes somewhere; `1` — the first, a thumb on the bar). */
const PILOT = Number(process.env.TM_E2E_AUTOPILOT_PILOT ?? 3);
/** THE SOAK: minutes the page is left alone at each generation's sample point (0 — a plain game). */
const IDLE_MIN = Number(process.env.TM_E2E_AUTOPILOT_IDLE_MIN ?? 0);

function gamesOf(spec: string): Array<number> {
  const range = /^(\d+)-(\d+)$/.exec(spec);
  if (range !== null) {
    const from = Number(range[1]);
    return Array.from({length: Math.max(0, Number(range[2]) - from + 1)}, (_, i) => from + i);
  }
  return spec.split(',').map((part) => Number(part.trim())).filter((n) => Number.isFinite(n));
}
const GAMES = gamesOf(process.env.TM_E2E_AUTOPILOT_GAMES ?? '1-2');

/** mulberry32 — the monkey's generator (`console-monkey.spec.ts`): the same game on every machine for one seed. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The boards MarsBot plays on (`common/automa/automaCompatibility.ts`), by the names the creator sends. */
const BOARDS = ['tharsis', 'hellas', 'elysium', 'utopia planitia', 'terra cimmeria nova', 'vastitas borealis nova', 'vastitas borealis',
  'amazonis p.', 't. cimmeria', 'arabia terra', 'Hollandia'] as const;

/**
 * THE TABLE OF GAME `n` — what the creator's payload can say (`create/premium/buildCreateGamePayload.ts`): the
 * in-scope expansions under their dependencies (Redux needs Colonies, Prelude 2 needs Prelude), Solar Phase with Venus
 * and without the bot, no pre-game draft. Not `testMode`: a real game's economy and its real length.
 */
function tableOf(n: number): {config: Record<string, unknown>, word: string, duo: boolean} {
  const r = rng(`${NAME}:${n}:table`);
  const flip = (p: number) => r() < p;
  const bot = flip(0.75);
  // A SECOND HUMAN (stage 6 — the autopilot widened, 2026-11-25): one table in two without the bot seats another
  // player, answered over the API — its turns, its tiles, its delegates, its draft are FOREIGN to this console, the
  // classes the solo tables never walk (a rival's landing behind the viewer's screen, a rival's vote in a sitting).
  const duo = !bot && flip(0.5);
  const prelude = flip(0.6);
  const venus = flip(0.5);
  const redux = flip(0.4);
  const colonies = redux || flip(0.5);
  const expansions = {
    promo: flip(0.5), venus, colonies, prelude, prelude2: prelude && flip(0.5), ares: flip(0.35), deltaProject: flip(0.4), turmoilRedux: redux,
  };
  const board = BOARDS[Math.floor(r() * BOARDS.length)];
  const draft = flip(0.5);
  const config = soloGameConfig({
    ...(duo ? {players: [
      {name: 'ConsoleTester', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Rival', color: 'blue', beginner: false, handicap: 0, first: false},
    ]} : {}),
    expansions, board, seed: r(), testMode: false, draftVariant: draft, solarPhaseOption: venus && !bot, altVenusBoard: venus && flip(0.4),
    ...(bot ? {automa: {difficulty: (['easy', 'normal', 'hard'] as const)[Math.floor(r() * 3)], secondShift: flip(0.6), extraCorporations: flip(0.5)}} : {}),
  });
  const on = Object.entries(expansions).filter(([, v]) => v).map(([k]) => k);
  return {config, duo, word: `${bot ? 'vs MarsBot' : duo ? 'duo' : 'solo'} · ${board} · ${on.join('+') || 'base'}${draft ? ' · draft' : ''}`};
}

type Wire = {
  game: {phase: string, generation: number, gameAge: number, temperature?: number, oxygenLevel?: number, oceans?: number, venusScaleLevel?: number},
  thisPlayer?: {tableau?: Array<{name: string}>},
  waitingFor?: {
    type: string, promptId?: number, bonusActionPrompt?: unknown, title?: unknown, min?: number, max?: number, cards?: Array<unknown>,
    options?: Array<{type: string, warnings?: Array<string>, cards?: Array<{name: string, isDisabled?: boolean, calculatedCost?: number}>}>,
  } & Record<string, unknown>,
};

/**
 * THE STANDARD PROJECTS THAT TERRAFORM — what the rival seat plays when it can afford one: a duo table whose rival
 * only took the menu's first branch or passed did not terraform, and stood for 28 generations until the press budget
 * capped it (CI's autopilot, game 52). The table must reach its end for the walk to see the whole game.
 */
const TERRAFORMING_SP: ReadonlyArray<string> = ['Asteroid:SP', 'Aquifer', 'Greenery', 'Air Scrapping'];

/** The keys of the pad as the key bridge maps them — by the glyph the bar prints. */
const GLYPH_KEY: Readonly<Record<string, string>> = {
  'A': 'Enter', 'B': 'Escape', 'X': 'KeyX', 'Y': 'KeyY', 'LB': 'KeyQ', 'RB': 'KeyE', 'LT': 'Comma', 'RT': 'Period', 'L3': 'KeyC', 'R3': 'KeyV', '⧉': 'KeyR',
};
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
const ANY = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Enter', 'Enter', 'Escape', 'KeyX', 'KeyY', 'KeyQ', 'KeyE', 'Comma', 'Period', 'KeyC', 'KeyV', 'KeyR'] as const;
/** The keys that open a LOOK — a player reads it and closes it; a pilot that is going somewhere seldom opens one. */
const LOOK_KEYS: ReadonlySet<string> = new Set(['KeyX', 'KeyR', 'KeyC', 'KeyV']);

/** What stands on screen as the pilot reads it: the verbs the bar offers, the stack, the bar's words. */
type Screen = {
  offered: Array<{key: string, hot: boolean}>, frames: Array<string>, bar: string, zoom: boolean, quick: boolean, pass: boolean, confirm: boolean,
  /** A LOOK of the player's own stands (`info` — closed by Y; the journal and the «Разыграно» table — by B). */
  look: '' | 'info' | 'journal' | 'played',
  /** The layout of a production loss stands. */
  prodLoss: boolean,
  /**
   * The keys of the bar's commands that stand DISABLED — not offered, yet the screen's own word for the next press once
   * the layout is complete (a pick of exactly two cards: «RT Сбросить» stays grey until the second card).
   */
  greyed: Array<string>,
};

/**
 * WHERE A TURN GOES (pilot 2): the wheel that leads to a section and the press that enters it — RT's five and LT's
 * three that start something. In rotation by the game and the turn, so one game visits them all.
 */
const INTENTS: ReadonlyArray<{name: string, keys: ReadonlyArray<string>}> = [
  {name: 'hand', keys: ['Period', 'Enter']},
  {name: 'card-actions', keys: ['Period', 'ArrowUp']},
  {name: 'trading', keys: ['Period', 'ArrowRight']},
  {name: 'standard-projects', keys: ['Comma', 'Enter']},
  {name: 'parliament', keys: ['Period', 'ArrowDown']},
  {name: 'hand', keys: ['Period', 'Enter']},
  {name: 'hydro', keys: ['Period', 'ArrowLeft']},
  {name: 'convert-plants', keys: ['Comma', 'ArrowLeft']},
  {name: 'card-actions', keys: ['Period', 'ArrowUp']},
  {name: 'convert-heat', keys: ['Comma', 'ArrowRight']},
];

async function look(page: Page): Promise<Screen> {
  return page.evaluate((glyphs) => {
    const offered: Array<{key: string, hot: boolean}> = [];
    const greyed: Array<string> = [];
    for (const cmd of document.querySelectorAll('.con-cmdbar__cmd')) {
      if (cmd.classList.contains('con-cmdbar__cmd--disabled')) {
        for (const glyph of cmd.querySelectorAll('.gp-glyph')) {
          const key = glyphs[(glyph.textContent ?? '').trim()];
          if (key !== undefined) {
            greyed.push(key);
          }
        }
        continue;
      }
      for (const glyph of cmd.querySelectorAll('.gp-glyph')) {
        const key = glyphs[(glyph.textContent ?? '').trim()];
        if (key !== undefined) {
          offered.push({key, hot: cmd.classList.contains('con-cmdbar__cmd--hot')});
        }
      }
    }
    const ready = (window as unknown as {__conReady?: () => {wsFrames?: Array<string>}}).__conReady?.();
    return {
      offered,
      greyed,
      frames: ready?.wsFrames ?? [],
      bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
      zoom: document.querySelector('dialog.con-zoom[open]') !== null,
      look: document.querySelector('.con-info') !== null ? 'info' as const : document.querySelector('.con-journal') !== null ? 'journal' as const :
        document.querySelector('.con-played:not(.con-played--hero):not(.con-played--embedded)') !== null ? 'played' as const : '' as const,
      prodLoss: document.querySelector('.con-prodloss') !== null,
      quick: document.querySelector('.con-quick') !== null,
      pass: document.querySelector('.con-quick [data-quick-id="pass"]') !== null,
      confirm: document.querySelector('.con-confirm') !== null,
    };
  }, GLYPH_KEY);
}

/**
 * `toTheQuestion` — THE PILOT IS ANSWERING (the second half of a question's budget, after its walk home): at the board
 * home it takes the way the home offers (A — the plate's «Открыть», «Вернуться к заседанию»), and on the question's
 * own screen it presses what carries a flow on (A, RT, the hot verb) and next to never what leaves or only reads. The
 * box's whole games with the trail, 2026-11-24: at home the wandering pick chose the wheels four times of five, and the
 * door answered questions whose way back stood on the bar the whole time.
 */
function pilotPick(screen: Screen, g: () => number, last: string | undefined, toTheQuestion: boolean = false): string {
  if (last !== undefined && LOOK_KEYS.has(last) && g() < 0.75) {
    return 'Escape';
  }
  // A LOOK STANDS OPEN (the fullscreen viewer — it covers the bar, whose words under it are another screen's): a
  // player reads it, turns a page or two, and CLOSES it. (The same games: X at the sitting's results, then eleven
  // presses of A inside the viewer while the bar under it read «A К исследованию» — and the door answered.)
  if (screen.zoom) {
    return toTheQuestion || g() < 0.5 ? 'Escape' : ARROWS[Math.floor(g() * ARROWS.length)];
  }
  // …AND SO IS EVERY OTHER LOOK OF THE PLAYER's OWN (pilot 2): the information screen closes by Y, the journal and the
  // «Разыграно» table by B. A pilot that is answering leaves it at once; one that is wandering reads on for a while.
  if (PILOT >= 2 && screen.look !== '' && (toTheQuestion || g() < 0.35)) {
    return screen.look === 'info' ? 'KeyY' : 'Escape';
  }
  const offersA = screen.offered.some((o) => o.key === 'Enter');
  if (toTheQuestion && offersA && screen.frames.length === 0 && !screen.quick) {
    return 'Enter';
  }
  const roll = g();
  if (roll < (toTheQuestion ? 0.8 : 0.7) && screen.offered.length > 0) {
    const carries = (o: {key: string, hot: boolean}): number => (o.hot ? 8 : 0) + (o.key === 'Enter' ? 6 : o.key === 'Period' ? 4 : 0);
    const weight = (o: {key: string, hot: boolean}): number => (toTheQuestion ?
      (carries(o) > 0 ? carries(o) + 4 : o.key === 'KeyX' ? 2 : LOOK_KEYS.has(o.key) || o.key === 'Escape' || o.key === 'Comma' || o.key === 'KeyY' ? 0.1 : 1) :
      (LOOK_KEYS.has(o.key) ? 0.5 : (o.hot ? 8 : 0) + (o.key === 'Enter' ? 6 : o.key === 'Period' ? 4 : o.key === 'Escape' ? 0.5 : 2)));
    let x = g() * screen.offered.reduce((sum, o) => sum + weight(o), 0);
    for (const o of screen.offered) {
      x -= weight(o);
      if (x < 0) {
        return o.key;
      }
    }
    return screen.offered[0].key;
  }
  return roll < 0.93 ? ARROWS[Math.floor(g() * ARROWS.length)] : ANY[Math.floor(g() * ANY.length)];
}

type Played = {
  end: 'finished' | 'capped' | 'stuck', presses: number, generation: number, phase: string,
  byUi: Record<string, number>, byApi: Record<string, number>, passes: {ui: number, api: number}, doors: Array<string>, tookMs: number,
  /**
   * THE SOAK's SAMPLES — once a generation, at the same place every time (the viewer's action menu with nothing on the
   * stack): the DOM's nodes, the kernel's scopes and waits, the heap. A page that leaks grows from generation to generation.
   */
  soak: Array<Record<string, number>>,
  /** THE SOAK's SPELLS (`TM_E2E_AUTOPILOT_IDLE_MIN`): what the page did with each stretch of nobody pressing. */
  spells: Array<Record<string, number>>,
};

/** What the BROWSER says of the page (CDP `Performance.getMetrics`, after a collection of garbage). */
type PageMetrics = {heapMb: number, nodes: number, listeners: number, layouts: number, styles: number, scriptS: number, taskS: number};

/** The soak's ears on the page's console: the long frames and the warnings of a spell are counted by the test. */
type SoakEars = {longFrames: number, warnings: number, lastWarnings: Array<string>};

/**
 * THE QUESTION, AS A DOOR's RECORD NAMES IT — its type, its title's key, the markers the server put on it (a draft, a
 * deck pick, a start prompt, a choice's context…) and its count: «card» alone said nothing about which of a dozen
 * card questions the screen could not be walked to (the 82 doors of the fourth hundred).
 */
function questionWord(wf: NonNullable<Wire['waitingFor']>): string {
  const title = typeof wf.title === 'string' ? wf.title : String((wf.title as {message?: string} | undefined)?.message ?? '');
  const markers = Object.keys(wf).filter((key) => /(Prompt|Context|reveal)$/i.test(key) && wf[key] !== undefined && wf[key] !== null)
    .map((key) => {
      const kind = (wf[key] as {kind?: unknown, mode?: unknown, source?: {kind?: unknown}} | undefined);
      const of = kind?.kind ?? kind?.mode ?? kind?.source?.kind;
      return typeof of === 'string' ? `${key}:${of}` : key;
    });
  const count = wf.type === 'card' ? ` ${wf.min ?? '?'}..${wf.max ?? '?'} of ${(wf.cards ?? []).length}` : '';
  return `${wf.type}${count} «${title.slice(0, 48)}»${markers.length > 0 ? ` [${markers.join(',')}]` : ''}`;
}

/**
 * THE LOG OF A WHOLE GAME (the owner's bar, 2026-11-25: «чтобы лог был чист» — no error, no freeze, not a warning, on
 * ANY run). Every warning and error of the page's console, every page error, every HTTP answer of 400 and above — the
 * whole game, never its last lines — folded by what it says (the numbers taken out), each kept with its first
 * occurrence: when, where the pilot stood, the console lines before it. The walk carries a mark where each was said
 * (`[!…]`), the game's record carries the book, and the report's ZERO gate reads it.
 */
type LogBook = Map<string, {type: string, n: number, first: string, atMs: number, stood: string, before: Array<string>}>;
const LOG_KEY_MAX = 96;
function logKey(type: string, text: string): string {
  return `${type} ${text.replace(/https?:\/\/[^/\s]+/g, '').replace(/#?\b[0-9a-f]{6,}\b/gi, '#').replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim().slice(0, LOG_KEY_MAX)}`;
}

/**
 * THE OPENING OF ANOTHER HUMAN SEAT (a duo table): its corporation, preludes and research answered over the API, until
 * nothing is asked of it in the action phase — its first turn comes after the viewer's (the shared seeder waits for
 * the seat's own action menu, which here only the viewer's pilot can bring).
 */
async function seedRivalOpening(request: APIRequestContext, rival: string): Promise<void> {
  for (let round = 0; round < 40; round++) {
    let model = await fetchPlayerModel(request, rival) as unknown as Wire;
    for (let waited = 0; model.waitingFor === undefined && model.game.phase !== 'action' && waited < 120; waited++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      model = await fetchPlayerModel(request, rival) as unknown as Wire;
    }
    const asked = model.waitingFor;
    if (asked === undefined || asked.options?.some((o) => o.type === 'option' && o.warnings?.includes('pass') === true) === true) {
      return;
    }
    await sendPlayerInput(request, rival, {...answerPrompt(asked as never, {buy: 2}), promptId: asked.promptId} as never);
  }
}

async function playGame(page: Page, request: APIRequestContext, viewer: string, seed: string, log: Array<string>, ears?: SoakEars, where?: {stood: string},
  rivals: ReadonlyArray<string> = []): Promise<Played> {
  const g = rng(`${seed}:pilot`);
  const rivalRng = rng(`${seed}:rival`);
  /**
   * THE OTHER HUMAN SEATS (a duo table): each answered over the API whenever it is asked — a pass now and then, else the
   * answer the harness knows for its question (`answerPrompt`), the pass when it knows none; a few in a row (a follow-up
   * asks the same seat again). Its moves reach this console as another player's: the foreign classes of the console.
   */
  const rivalStuck = new Set<number>();
  const rivalsMove = async (): Promise<number> => {
    let moves = 0;
    for (const rival of rivals) {
      for (let i = 0; i < 6; i++) {
        const asked = (await fetchPlayerModel(request, rival) as unknown as Wire).waitingFor;
        if (asked === undefined) {
          break;
        }
        const options = asked.type === 'or' ? asked.options ?? [] : [];
        const pass = options.findIndex((o) => o.type === 'option' && o.warnings?.includes('pass') === true);
        // The answers to try, in order: a pass now and then, the harness's own answer, and — for a menu — every plain
        // option of it (an «end», a «skip», a «do nothing»): a seat must never stand on a question it cannot answer.
        const tries: Array<unknown> = [];
        // (A seat that can terraform mostly does — the table goes on to its end.)
        const projects = options.findIndex((o) => o.type === 'projectCard' && (o.cards ?? []).some((c) => TERRAFORMING_SP.includes(c.name) && c.isDisabled !== true));
        const project = projects >= 0 ? options[projects].cards?.find((c) => TERRAFORMING_SP.includes(c.name) && c.isDisabled !== true) : undefined;
        if (project !== undefined && rivalRng() < 0.8) {
          tries.push({type: 'or', index: projects, response: {type: 'projectCard', card: project.name, payment: {...NO_PAYMENT, megacredits: project.calculatedCost ?? 0}}});
        }
        if (pass >= 0 && rivalRng() < 0.3) {
          tries.push({type: 'or', index: pass, response: {type: 'option'}});
        }
        // DELTA PROJECT's ADVANCE (CI's autopilot on `a3c1a4cd33`, games 209 and 246 — STUCK, the seat ten minutes on
        // it): the step's budget is energy PLUS a 1:1 steel substitute (Delta Works, and the steel on Modular Floodgates), and the harness's one answer paid it all in
        // energy — refused once the energy was short, and the seat had no other. Every legal step count, the steel
        // share from none up: one of them is the payment the server takes.
        if (asked.type === 'deltaProject') {
          for (const amount of (asked as {validSteps?: Array<number>}).validSteps ?? []) {
            for (let steel = 0; steel <= amount; steel++) {
              // (…and the steel on Modular Floodgates — the budget counts it too.)
              for (let cardSteel = 0; steel + cardSteel <= amount; cardSteel++) {
                tries.push({type: 'deltaProject', amount, steel, cardSteel, waiveReward: true});
              }
            }
          }
        }
        try {
          tries.push(answerPrompt(asked as never, {}));
        } catch {
          // (no answer the harness knows — the plain options below)
        }
        options.forEach((o, index) => {
          if (o.type === 'option') {
            tries.push({type: 'or', index, response: {type: 'option'}});
          }
        });
        let answered = false;
        let refused = '';
        for (const response of tries) {
          try {
            await sendPlayerInput(request, rival, {...(response as object), promptId: asked.promptId} as never);
            answered = true;
            break;
          } catch (e) {
            // the server refused this one — the next (its word kept: a stuck seat names why)
            refused = String((e as Error).message ?? e).split('\n').find((line) => /rejected/.test(line))?.slice(0, 220) ?? '';
          }
        }
        if (!answered) {
          if (asked.promptId !== undefined && !rivalStuck.has(asked.promptId)) {
            rivalStuck.add(asked.promptId);
            log.push(`[RIVAL-STUCK ${asked.type} «${typeof asked.title === 'string' ? asked.title : (asked.title as {message?: string} | undefined)?.message ?? ''}» options ${options.map((o) => o.type).join(',')} · ${tries.length} tried · last refusal: ${refused}]`);
          }
          break;
        }
        moves++;
      }
    }
    return moves;
  };
  const started = Date.now();
  const played: Played = {end: 'capped', presses: 0, generation: 0, phase: '', byUi: {}, byApi: {}, passes: {ui: 0, api: 0}, doors: [], tookMs: 0, soak: [], spells: []};
  const bump = (into: Record<string, number>, key: string): void => {
    into[key] = (into[key] ?? 0) + 1;
  };
  let lastKey: string | undefined;
  // WHAT STOOD when the press was chosen — the frames, the server's question, the bar — written into the walk where it
  // CHANGED (a finding of the box is read press by press, as the bottle's are).
  let stood = '';
  let saidStood = '';
  const press = async (key: string, pauseMs: number): Promise<void> => {
    log.push(`${Date.now() % 1_000_000}:${key}${stood !== saidStood ? `{${stood}}` : ''}`);
    saidStood = stood;
    if (where !== undefined) {
      where.stood = stood;
    }
    await page.keyboard.press(key);
    lastKey = key;
    played.presses++;
    await cinematicBeat(page, pauseMs, 'the rhythm of the pilot — a player pauses between presses, by design');
  };
  const pause = (): number => {
    const roll = g();
    return Math.round(roll < 0.75 ? 150 + g() * 350 : roll < 0.97 ? 600 + g() * 1200 : 2500 + g() * 3000);
  };
  const truth = async (): Promise<Wire> => await fetchPlayerModel(request, viewer) as unknown as Wire;
  // (…and the bar's GREY verbs — a door over a commit the screen held disabled reads why the pilot never pressed it: the CI
  // autopilot's game 220, a land claim whose «A Выбрать клетку» the pilot never took.)
  const stands = (s: Screen): string => `frames ${s.frames.join('>') || 'none'} · bar «${s.bar}»${s.greyed.length > 0 ? ` · grey ${[...new Set(s.greyed)].join(',')}` : ''}`;
  /**
   * THE BOARD HOME — every level between it and the pilot is left the way a player leaves it: B where the bar offers B
   * (a workspace, a look, a wheel), Y where the bar closes only by Y (the information screen's top). The home is the
   * screen whose bar offers the basic wheel and no way back (`orPass` — the pass slot in sight is home enough).
   */
  const walkHome = async (orPass: boolean): Promise<void> => {
    for (let i = 0; i < 10; i++) {
      const s = await look(page);
      const offers = (key: string): boolean => s.offered.some((o) => o.key === key);
      if ((orPass && s.pass) || (s.frames.length === 0 && !s.zoom && !s.quick && offers('Comma') && !offers('Escape'))) {
        break;
      }
      await press(offers('Escape') || !offers('KeyY') ? 'Escape' : 'KeyY', 600);
    }
  };
  /** An answer over the API, as another device of the seat would give it. `false` — the drivers' answerer has none, or the server refused it. */
  const byDoor = async (wf: NonNullable<Wire['waitingFor']>): Promise<boolean> => {
    try {
      const pass = wf.type === 'or' ? (wf.options ?? []).findIndex((o) => o.type === 'option' && o.warnings?.includes('pass') === true) : -1;
      const response = pass >= 0 ? {type: 'or', index: pass, response: {type: 'option'}} : answerPrompt(wf as never, {});
      await sendPlayerInput(request, viewer, {...response, promptId: wf.promptId} as never);
      return true;
    } catch {
      return false;
    }
  };

  /** WHO THE PAGE SAYS SERVES THE QUESTION right now (`__conOwnerNow` — the one function's answer and its facts). */
  const ownerNow = (): Promise<string> =>
    page.evaluate(() => (window as unknown as {__conOwnerNow?: () => string}).__conOwnerNow?.() ?? '').catch(() => '');
  let standing: {promptId: number | undefined, type: string, menu: boolean, bonus: boolean, presses: number, budget: number, byApi: boolean, intent: Array<string>, intentful: boolean,
    /** Presses in a row that changed nothing of what stands (pilot 3 — a player who gets no answer goes home). */
    still: number, lastStood: string,
    /** Looks in a row in a side screen while the one function names the question held by its plate or set aside. */
    heldAway: number} | undefined;
  /** The menus of the game so far — the intents' rotation (seeded by the game's own number, so two games start apart). */
  let menus = Math.floor(g() * INTENTS.length);
  /** The tableau's length at the last look (-1 before the first: the opening's cards are no play of the walk). */
  let seenTableau = -1;
  let moved = {age: -1, at: Date.now()};
  let sampledGeneration = 0;
  while (played.presses < PRESSES && !page.isClosed()) {
    const model = await truth();
    // WHAT THE SEAT PLAYED, in the walk (`[PLAYED <card>]`): a line of the log is read against the card that made it —
    // the box's game 1656, whose level door stood after a card nobody could name from the walk.
    const tableau = model.thisPlayer?.tableau ?? [];
    if (seenTableau >= 0 && tableau.length > seenTableau) {
      log.push(`[PLAYED ${tableau.slice(seenTableau).map((card) => card.name).join(' + ')}]`);
    }
    seenTableau = tableau.length;
    // THE TABLE's CLOCK, once a generation (`[GEN n · T · O · W · V]`): a duo table that stood on the cap at generation 92
    // (the night count's 1823) read nothing of who was terraforming — the next one says it.
    if (model.game.generation !== played.generation && played.generation > 0) {
      const g = model.game;
      log.push(`[GEN ${g.generation} · T${g.temperature ?? '?'} · O${g.oxygenLevel ?? '?'} · W${g.oceans ?? '?'}${g.venusScaleLevel === undefined ? '' : ` · V${g.venusScaleLevel}`}]`);
    }
    played.generation = model.game.generation;
    played.phase = model.game.phase;
    if (model.game.phase === 'end') {
      break;
    }
    if (model.game.gameAge !== moved.age) {
      moved = {age: model.game.gameAge, at: Date.now()};
    }
    const wf = model.waitingFor;
    if (wf === undefined) {
      // NOBODY ASKS THE VIEWER: the bot's turn, a scene of the page's own. A press may be owed all the same (a
      // reveal's take, a plate, a result's acknowledge) — the pilot looks on. Ten minutes of a table nobody moves is stuck.
      if (standing !== undefined) {
        bump(standing.byApi ? played.byApi : played.byUi, standing.menu ? 'or:menu' : standing.type);
        standing = undefined;
      }
      if (Date.now() - moved.at > 10 * 60_000) {
        played.end = 'stuck';
        break;
      }
      // (A duo table: the other human's turn — it moves, and the pilot looks on at what it did.)
      if (rivals.length > 0) {
        const moves = await rivalsMove();
        if (moves > 0) {
          log.push(`[RIVAL×${moves}]`);
          continue;
        }
      }
      await press(g() < 0.5 ? pilotPick(await look(page), g, lastKey) : 'ArrowDown', 500 + Math.round(g() * 700));
      continue;
    }
    if (standing === undefined || standing.promptId !== wf.promptId) {
      if (standing !== undefined) {
        bump(standing.byApi ? played.byApi : played.byUi, standing.menu ? 'or:menu' : standing.type);
      }
      const menu = wf.type === 'or' && (wf.options ?? []).some((o) => o.type === 'option' && o.warnings?.includes('pass') === true);
      // (Pilot 2: three menus in four have an INTENT — the turn goes to one section and plays there; the budget is
      // then never shorter than the way in and a few presses inside.)
      // A BONUS ACTION's MENU (the server's marker — «Фора»'s two actions, a card's granted one) is an action menu
      // with NO PASS: the player must act. The pilot read it as a question the screen does not answer and thumbed
      // the board for forty-five presses until the door acted for it (the third hundred's game 906). It is a turn
      // like any other — always with an intent, and a second one when the first led nowhere.
      const bonus = PILOT >= 2 && wf.type === 'or' && !menu && wf.bonusActionPrompt !== undefined;
      const intentful = PILOT >= 2 && (bonus || (menu && g() < 0.75));
      const intent = intentful ? [...INTENTS[menus++ % INTENTS.length].keys] : [];
      const budget = bonus ? 60 : menu ? (g() < (intentful ? 0.05 : 0.18) ? 0 : (intentful ? 9 : 4) + Math.floor(g() * 23)) : 45;
      standing = {promptId: wf.promptId, type: wf.type, menu, bonus, presses: 0, budget, byApi: false, intent: budget > 0 ? intent : [], intentful: intentful && budget > 0, still: 0, lastStood: '', heldAway: 0};
      if (standing.intent.length > 0) {
        log.push(`[INTENT ${INTENTS[(menus - 1) % INTENTS.length].name}]`);
      }
    }
    if (standing.menu && sampledGeneration !== model.game.generation) {
      const sample = await page.evaluate(() => {
        const w = window as unknown as {__conReady?: () => {wsFrames?: Array<string>, holds?: Array<string>}, __conFlow?: () => {scopes?: number, waits?: Array<unknown>}};
        if ((w.__conReady?.().wsFrames ?? []).length > 0) {
          return undefined;
        }
        const flow = w.__conFlow?.();
        return {
          nodes: document.querySelectorAll('*').length,
          scopes: flow?.scopes ?? -1,
          waits: flow?.waits?.length ?? -1,
          heapMb: Math.round(((performance as unknown as {memory?: {usedJSHeapSize: number}}).memory?.usedJSHeapSize ?? 0) / 1e6),
        };
      });
      if (sample !== undefined) {
        sampledGeneration = model.game.generation;
        played.soak.push({gen: model.game.generation, ...sample});
        if (IDLE_MIN > 0 && ears !== undefined) {
          // THE SPELL: nobody presses. What the page does with the time is its own.
          const cdp = await page.context().newCDPSession(page);
          const ask = async (): Promise<PageMetrics> => {
            await cdp.send('Performance.enable');
            await cdp.send('HeapProfiler.collectGarbage');
            const {metrics} = await cdp.send('Performance.getMetrics');
            const of = (name: string): number => metrics.find((m) => m.name === name)?.value ?? -1;
            return {
              heapMb: Math.round(of('JSHeapUsedSize') / 1e4) / 100, nodes: of('Nodes'), listeners: of('JSEventListeners'),
              layouts: of('LayoutCount'), styles: of('RecalcStyleCount'), scriptS: Math.round(of('ScriptDuration') * 100) / 100, taskS: Math.round(of('TaskDuration') * 100) / 100,
            };
          };
          // …AND WHAT IS KEPT ALIVE OFF THE DOCUMENT (the first soak's reading: the browser's node count grew from
          // generation to generation — 5 078 · 8 118 · 14 535 — while the ATTACHED elements at the same menu stood at
          // ≈ 1 300): the trees detached from the document and still referenced by a script, by the root's tag and
          // first class — who keeps them is read off the name. (`DOM.getDetachedDomNodes`; a browser without it says
          // nothing here.)
          type DetachedNode = {nodeName?: string, attributes?: Array<string>, children?: Array<DetachedNode>};
          const detachedNow = async (): Promise<{roots: number, nodes: number, top: string} | undefined> => {
            try {
              await cdp.send('DOM.enable');
              const {detachedNodes} = await (cdp as unknown as {send(method: string): Promise<{detachedNodes: Array<{treeNode: DetachedNode}>}>}).send('DOM.getDetachedDomNodes');
              const size = (node: DetachedNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + size(child), 0);
              const by = new Map<string, {roots: number, nodes: number}>();
              let nodes = 0;
              for (const {treeNode} of detachedNodes) {
                const at = (treeNode.attributes ?? []).indexOf('class');
                const cls = at >= 0 ? (treeNode.attributes?.[at + 1] ?? '').trim().split(/\s+/)[0] : '';
                const label = `${(treeNode.nodeName ?? '?').toLowerCase()}${cls !== '' ? `.${cls}` : ''}`;
                const n = size(treeNode);
                nodes += n;
                const row = by.get(label) ?? {roots: 0, nodes: 0};
                row.roots++;
                row.nodes += n;
                by.set(label, row);
              }
              const top = [...by].sort((a, b) => b[1].nodes - a[1].nodes).slice(0, 8).map(([label, row]) => `${label}×${row.roots}=${row.nodes}`).join(' ');
              return {roots: detachedNodes.length, nodes, top};
            } catch {
              return undefined;
            }
          };
          const before = await ask();
          const heard = {longFrames: ears.longFrames, warnings: ears.warnings};
          const spellStarted = Date.now();
          for (let minute = 0; minute < IDLE_MIN; minute++) {
            await cinematicBeat(page, 60_000, 'the soak — the page is left alone at its action menu, a console nobody is pressing');
          }
          const after = await ask();
          const detached = await detachedNow();
          await cdp.detach();
          const spell = {
            gen: model.game.generation, minutes: Math.round((Date.now() - spellStarted) / 6_000) / 10,
            heapMb: after.heapMb, heapDeltaMb: Math.round((after.heapMb - before.heapMb) * 100) / 100,
            nodes: after.nodes, nodesDelta: after.nodes - before.nodes,
            listeners: after.listeners, listenersDelta: after.listeners - before.listeners,
            layouts: after.layouts - before.layouts, styles: after.styles - before.styles,
            scriptS: Math.round((after.scriptS - before.scriptS) * 100) / 100, taskS: Math.round((after.taskS - before.taskS) * 100) / 100,
            longFrames: ears.longFrames - heard.longFrames, warnings: ears.warnings - heard.warnings,
            ...(detached !== undefined ? {detachedTrees: detached.roots, detachedNodes: detached.nodes} : {}),
          };
          played.spells.push(spell);
          // (Said as it happens: a soak is hours, and its numbers are read while it runs.)
          console.log(`[autopilot-soak] ${seed} ${JSON.stringify(spell)}${spell.warnings > 0 ? ` — the warnings of the spell: ${ears.lastWarnings.slice(-Math.min(4, spell.warnings)).join(' ¦ ')}` : ''}` +
            (detached !== undefined ? ` — detached and kept: ${detached.roots} tree(s), ${detached.nodes} node(s): ${detached.top}` : ''));
          // The table did not move by itself: the question that stood still stands (the spell is not a stall of the game).
          moved = {age: moved.age, at: Date.now()};
        }
      }
    }
    if (standing.presses >= standing.budget) {
      if (standing.menu) {
        // THE TURN ENDS, by the wheel: the board home (B, one level a press), LT, ↓, the confirm — verified on the SERVER.
        let landed = false;
        const before = stands(await look(page));
        for (let attempt = 0; attempt < 3 && !landed; attempt++) {
          await walkHome(true);
          if (!(await look(page)).pass) {
            await press('Comma', 500);
          }
          await expect.poll(async () => (await look(page)).pass, {timeout: 3_000}).toBe(true).catch(() => undefined);
          await press('ArrowDown', 500);
          await expect.poll(async () => (await look(page)).confirm, {timeout: 3_000}).toBe(true).catch(() => undefined);
          await press('Enter', 800);
          landed = await expect.poll(async () => (await truth()).waitingFor?.promptId !== wf.promptId, {timeout: 8_000}).toBe(true).then(() => true, () => false);
        }
        if (landed) {
          played.passes.ui++;
          log.push('[PASS]');
        } else {
          played.doors.push(`pass · gen ${model.game.generation} · ${before} → after the gesture: ${stands(await look(page))} · owner «${(await ownerNow()).split('\n')[0]}»`);
          await byDoor(wf);
          played.passes.api++;
          log.push('[PASS-BY-DOOR]');
        }
        standing = undefined;
      } else {
        played.doors.push(`${questionWord(wf)} · gen ${model.game.generation} · ${stands(await look(page))} · owner «${(await ownerNow()).replace('\n', ' — ').slice(0, 260)}»`);
        const answered = await byDoor(wf);
        log.push(`[BY-DOOR ${wf.type}${answered ? '' : ' REFUSED'}]`);
        if (answered) {
          standing.byApi = true;
        } else {
          // (No answer the door knows: the walk goes on pressing — a fresh budget, never a loop on the same refusal.)
          standing.presses = 0;
          standing.budget = 90;
        }
      }
      await cinematicBeat(page, 1_500, 'the page hears an answer given elsewhere by the socket or its poll — the pilot lets it');
      continue;
    }
    standing.presses++;
    // (A duo table in a SIMULTANEOUS phase — the draft, the research: the other human is asked while this question
    // stands; a repick waits on it. It moves every few presses, as a player at the next seat would.)
    if (rivals.length > 0 && standing.presses % 4 === 0) {
      const moves = await rivalsMove();
      if (moves > 0) {
        log.push(`[RIVAL×${moves}]`);
        continue;
      }
    }
    // HALF THE QUESTION's BUDGET SPENT AND IT STILL STANDS: a player asked something the screen in front of them does
    // not answer GOES HOME — the board, where the question's plate or its way back stands. (The passes of
    // 2026-11-24: the pilot browsed the Parliament's delegate stage for four questions in a row, and the door
    // answered each — a habit of the pilot, never a place of the product. What the door answers after this walk is
    // a question the HOME could not serve either.)
    if (!standing.menu && !standing.bonus && standing.presses === Math.floor(standing.budget / 2)) {
      await walkHome(false);
    }
    // (…and a bonus action that found nothing to do where it went goes SOMEWHERE ELSE — a new section every quarter of
    // its budget: four of them before the door acts.)
    if (standing.bonus && standing.presses > 1 && standing.presses % Math.max(1, Math.floor(standing.budget / 4)) === 0) {
      await walkHome(false);
      standing.intent = [...INTENTS[menus++ % INTENTS.length].keys];
      log.push(`[INTENT ${INTENTS[(menus - 1) % INTENTS.length].name}]`);
    }
    const seen = await look(page);
    stood = `${seen.frames.join('>') || '-'}${seen.zoom ? '+ZOOM' : ''}${seen.quick ? '+WHEEL' : ''}|${wf.type}#${wf.promptId ?? ''}|${seen.bar.slice(0, 80)}`;
    // THE TURN's INTENT (pilot 2): from the board home, the wheel that leads to the section and the press that enters
    // it — one after the other, nothing between.
    if (standing.intent.length > 0) {
      if (standing.presses === 1) {
        await walkHome(false);
      }
      await press(standing.intent.shift() as string, 500 + Math.round(g() * 400));
      continue;
    }
    // THE LAYOUT OF A LOSS (pilot 2): a unit off the focused row, another, the next row, and «Принять убыток» — until
    // the server has the answer.
    if (PILOT >= 2 && wf.type === 'productionToLose' && seen.prodLoss && seen.look === '' && !seen.zoom) {
      await press((['Enter', 'Enter', 'ArrowDown', 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // THE COMPOSITES WHOSE COMMIT IS NOT «A» — read BEFORE the home's wait below, which takes a bar with no «A» for a
    // question the screen does not answer and only nudges the stick (the night count's game 1826: «Распределение
    // ресурсов · LB/RB −1 / +1 · X Забрать», the pilot nudged the stick until the door answered).
    // THE HEAT SPENT AS M€ (pilot 3 — the fifth hundred's first doors, thirteen of them on one question): the composite
    // asks «how much heat»: RT takes the most it may, X pays — a player reads both off the bar.
    if (PILOT >= 3 && (wf as {spendHeatPrompt?: unknown}).spendHeatPrompt !== undefined && seen.look === '' && !seen.zoom && seen.frames.length === 0) {
      await press((['Period', 'KeyX'] as const)[standing.presses % 2], pause());
      continue;
    }
    // THE DISTRIBUTION OF RESOURCES (pilot 3): a unit onto the focused row (RB where the layout steps by LB/RB, A where A
    // adds), the next row, another — and the take.
    if (PILOT >= 3 && wf.type === 'resources' && seen.bar.startsWith('Распределение ресурсов') && seen.look === '' && !seen.zoom) {
      const add = seen.offered.some((o) => o.key === 'KeyE') ? 'KeyE' : 'Enter';
      await press(([add, 'ArrowDown', add, 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // A QUESTION THE SCREEN IN FRONT OF THE PILOT DOES NOT ANSWER (pilot 3). A player who presses and gets nothing
    // does not keep pressing: six presses in a row that changed nothing of what stands, inside a workspace → HOME,
    // where the question's plate or its way back stands. And AT home, with the question standing and no «A» on the
    // bar, a player WAITS — a nudge of the stick, never a wheel into another section (that walk away from a question
    // was most of the fourth hundred's doors: the pilot's habit, hiding the few places of the product).
    if (PILOT >= 3 && !standing.menu && !standing.bonus && seen.look === '' && !seen.zoom) {
      standing.still = stood === standing.lastStood ? standing.still + 1 : 0;
      standing.lastStood = stood;
      // (…«does not answer»: the question was SET ASIDE — the page's own word, what a player sees as «this is not my
      // question's screen». A surface that serves the question stands still under a d-pad walk too: a pick's bar does
      // not change with the cursor — the first pass of pilot 3 walked home out of a research buy it was laying out.
      // …or its PLATE stands at home: the draft / the research announced, and the pilot walked into a side screen
      // before it pressed the plate — `admission:announce-gate` is held until the plate's own press, and the plate is
      // on the board (the fifth hundred's doors, all of them: the pilot waited in «Действия карт» for a hold whose only
      // door was home).)
      // (…and a side screen whose cursor MOVES the bar — the colonies' trade under the draft's plate: «stood» changed at
      // every press, the six never came, and the door answered (the sixth count, eleven of its doors). Four looks in a
      // row in a side screen with the question held by its plate are a player who knows where the question is.)
      const heldAway = (seen.frames.length > 0 || seen.quick) && / held (aside:|admission:announce-gate)/.test(await ownerNow());
      standing.heldAway = heldAway ? standing.heldAway + 1 : 0;
      if (heldAway && (standing.still >= 6 || standing.heldAway >= 4)) {
        standing.still = 0;
        standing.heldAway = 0;
        log.push('[HOME]');
        await walkHome(false);
        continue;
      }
      // …AND AT HOME, THE WAY BACK: the question set aside (or held by its plate) with «A» on the bar — «Вернуться к
      // выбору», «Открыть» — is a player's next press. The pilot wandered into a wheel instead, its budget ran out and
      // the door answered the parked research buy: the draft's frame was dropped with its phase, a line of the log
      // that was the PILOT's (the sixth count, games 1631 and 1673 — both right after a door).
      if (seen.frames.length === 0 && !seen.quick && seen.offered.some((o) => o.key === 'Enter') &&
          / held (aside:|admission:announce-gate)/.test(await ownerNow())) {
        log.push('[WAY-BACK]');
        await press('Enter', pause());
        continue;
      }
      if (seen.frames.length === 0 && !seen.quick && !seen.offered.some((o) => o.key === 'Enter') && standing.presses >= Math.floor(standing.budget / 2)) {
        await press(ARROWS[Math.floor(g() * ARROWS.length)], pause());
        continue;
      }
    }
    // A PICK OF CARDS THAT COMMITS BY RT (pilot 3): once the question has stood a third of its budget — a card, the
    // commit, the next card (never the same card on and off). The commit may stand GREY until the layout is complete
    // — a pick of exactly two cards («Сбросить» for the Reds' party action): the pilot read only the verbs on offer,
    // never took this rule, and toggled one card on and off until the door answered (the night count, games 1802 and
    // 1803). A player reads the grey RT as the commit still to come.
    if (PILOT >= 3 && wf.type === 'card' && !standing.menu && standing.presses >= Math.floor(standing.budget / 3) && seen.look === '' && !seen.zoom && !seen.quick &&
        seen.offered.some((o) => o.key === 'Enter') && (seen.offered.some((o) => o.key === 'Period') || seen.greyed.includes('Period'))) {
      await press((['Enter', 'Period', 'ArrowRight'] as const)[standing.presses % 3], pause());
      continue;
    }
    // …AND A SINGLE PICK THAT COMMITS BY A («Выбрать» on the focused card — the table's answer to the Career's step, a
    // resource onto a card): once it has stood a third of its budget, A on the card, the next card if it was not one
    // the question takes. The pilot thumbed the bar around it until the door answered (the box's game 1676).
    if (PILOT >= 3 && wf.type === 'card' && !standing.menu && (wf.max ?? 1) === 1 && standing.presses >= Math.floor(standing.budget / 3) &&
        seen.look === '' && !seen.zoom && !seen.quick && seen.offered.some((o) => o.key === 'Enter') && !seen.offered.some((o) => o.key === 'Period')) {
      await press((['Enter', 'ArrowRight'] as const)[standing.presses % 2], pause());
      continue;
    }
    await press(pilotPick(seen, g, lastKey, standing.menu || standing.bonus ? standing.intentful : standing.presses >= Math.floor(standing.budget / 2)), pause());
  }
  if (played.phase === 'end') {
    // THE FINALE: the ceremony's screens are the page's own — pressed through like everything else.
    for (let i = 0; i < 40 && !page.isClosed(); i++) {
      await press(pilotPick(await look(page), g, lastKey), 700 + Math.round(g() * 1_300));
    }
    played.end = 'finished';
  }
  played.tookMs = Date.now() - started;
  return played;
}

test.describe('THE AUTOPILOT — whole games through the real console', () => {
  test.skip(!ENABLED, 'opt-in: TM_E2E_AUTOPILOT=1 (ten to twenty minutes of a runner per game)');

  for (const n of GAMES) {
    test(`autopilot · game ${n}`, async ({page, request, causeHarvest}) => {
      test.setTimeout((75 + IDLE_MIN * 30) * 60_000);
      const seed = `${NAME}:${n}`;
      const table = tableOf(n);
      test.info().annotations.push({type: 'autopilot-table', description: `${seed} — ${table.word}`});
      const created = await request.post('/api/creategame', {data: table.config});
      expect(created.ok(), `create-game refused the table (${table.word}): ${created.status()}`).toBeTruthy();
      const {players} = await created.json() as {players: Array<{id: string, name: string}>};
      const viewer = (players.find((p) => !/marsbot/i.test(p.name)) ?? players[0]).id;
      const rivals = players.filter((p) => p.id !== viewer && !/marsbot/i.test(p.name)).map((p) => p.id);
      // THE OPENING, over the API (see the header): the corporation, the preludes, the first action — to the first turn.
      // (Every human seat at once: the opening is simultaneous, and a seat seeded alone waits for the other one.)
      await Promise.all([seedGameOverApi(request, viewer, {buy: 4}), ...rivals.map((rival) => seedRivalOpening(request, rival))]);
      const log: Array<string> = [];
      const consoleTail: Array<string> = [];
      const ears: SoakEars = {longFrames: 0, warnings: 0, lastWarnings: []};
      const book: LogBook = new Map();
      const where = {stood: ''};
      const t0 = Date.now();
      const said = (type: string, text: string): void => {
        const key = logKey(type, text);
        const known = book.get(key);
        if (known !== undefined) {
          known.n++;
          return;
        }
        book.set(key, {type, n: 1, first: text.slice(0, 1200), atMs: Date.now() - t0, stood: where.stood, before: consoleTail.slice(-12)});
        log.push(`[!${key.slice(0, 70)}]`);
      };
      page.on('pageerror', (error) => said('pageerror', String(error?.message ?? error)));
      page.on('response', (response) => {
        if (response.status() >= 400) {
          said('http', `${response.status()} ${response.request().method()} ${response.url().replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '')}`);
        }
      });
      page.on('console', (message) => {
        consoleTail.push(`${Date.now() % 1_000_000} ${message.type()} ${message.text().slice(0, 600)}`);
        if (consoleTail.length > 600) {
          consoleTail.shift();
        }
        if (message.type() === 'warning' || message.type() === 'error') {
          const text = message.text();
          // (A failed resource is named by its URL through the response's own ear above — the console's line has none.)
          if (!text.startsWith('Failed to load resource')) {
            said(message.type(), text);
          }
          if (text.includes('[long-frame]')) {
            ears.longFrames++;
          }
          ears.warnings++;
          ears.lastWarnings.push(text.slice(0, 240));
          if (ears.lastWarnings.length > 8) {
            ears.lastWarnings.shift();
          }
        }
      });
      await openConsole(page, viewer);
      let played: Played | undefined;
      try {
        played = await playGame(page, request, viewer, seed, log, ears, where, rivals);
        // THE LAST WORD: past the arbiter's grace and the loop's twenty looks — the screen the game left is judged whole.
        await cinematicBeat(page, 25_000, 'the last word — a quiet spell past the liveness grace, so the screen the game left is judged');
      } finally {
        causeHarvest.note({
          monkey: {seed, fixture: `game-${n}`, mode: 'autopilot', landing: 'boot', duo: table.duo, reload: false, hidden: false, presses: played?.presses ?? log.filter((l) => !l.startsWith('[')).length,
            perturb: {netMs: 0, cpu: Number(process.env.TM_E2E_CPU_THROTTLE ?? 0), motion: process.env.TM_E2E_MOTION ?? ''}},
          autopilot: {
            ...played, table: table.word, pilot: PILOT,
            // THE LOG's BOOK: every class of line the page said in the whole game (the count, the first occurrence).
            log: [...book.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 80).map(([key, row]) => ({key, type: row.type, n: row.n, atMs: row.atMs, stood: row.stood.slice(0, 160)})),
          },
        });
        fs.writeFileSync(test.info().outputPath('autopilot-log.txt'), [...book.entries()].sort((a, b) => a[1].atMs - b[1].atMs).map(([key, row]) =>
          `── ${row.n}× ${key}\n   at ${Math.round(row.atMs / 1000)} s · the pilot stood: ${row.stood}\n   ${row.first}\n   before it:\n${row.before.map((line) => `     ${line.slice(0, 300)}`).join('\n')}\n`).join('\n'));
        fs.writeFileSync(test.info().outputPath('autopilot-walk.txt'),
          `seed=${seed} table=${table.word}\n${JSON.stringify(played, null, 1)}\n\n${log.join(' ')}\n\n── console (last ${consoleTail.length}) ──\n${consoleTail.join('\n')}\n`);
      }
      const sum = (row: Record<string, number>): string => Object.entries(row).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
      console.log(`[autopilot] game ${n} [${table.word}]: ${played.end} in generation ${played.generation} (${played.phase}) · ${played.presses} presses, ${Math.round(played.tookMs / 60_000)} min · ` +
        `by the screen: ${sum(played.byUi)} · by the door: ${sum(played.byApi)} · passes ${played.passes.ui} by the wheel / ${played.passes.api} by the door`);
      expect(page.isClosed(), 'the page survived the game').toBe(false);
      expect(played.end, 'a table nobody moves for ten minutes is stuck — the game did not go on').not.toBe('stuck');
    });
  }
});
