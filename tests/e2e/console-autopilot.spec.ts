import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import {answerPrompt, cinematicBeat, fetchPlayerModel, loadFixtureSeats, NO_PAYMENT, openConsole, reloadConsole, seedGameOverApi, sendPlayerInput, soloGameConfig, syncClient} from './consoleStart';
import {AutopilotScenario, dealFor, LEDGER_CARDS, SCENARIO_TARGETS, scenarioFor, ScopeCard, SCOPE_CARDS} from '../testing/autopilotDeal';
import {campaignConfig, campaignModelAs, devCommit, launchMission} from './campaignFixtures';
import {awayFromConsole, installPageAway} from './pageAway';
import {TENDER_IDS} from '../../src/common/campaign/tenders';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';

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
/**
 * THE WEATHER (stage 6, total coverage — the owner, 2026-11-26: «чтобы на продакшене потом не было сюрпризов»): the
 * kernel's submit machine had walked two of its eight moves in the box's count of 84 games — never `sending → failed`,
 * never `sending → refused`: every road a press takes when the network or the server lets it down (a couch on Wi-Fi)
 * was a road no game had walked. In a STORM game the submits meet the weather a player meets, now and then:
 *   · `lost` — the request never reaches the server (the fetch fails);
 *   · `lost-answer` — the server MADE the move and the answer is lost on the way back (the page says «cannot contact»,
 *     its question is stale, the next press is refused `STALE_PROMPT` and the truth fetched again);
 *   · `busy` — the server answers 503 (a restart, a proxy);
 *   · `stale` — the press answers a prompt the server has moved on from (the promptId of the one before);
 *   · and ONCE a storm game, a RELOAD between two presses (the app restarted, the Deck woke from its sleep) — the
 *     page boots on whatever stood: a flow mid-way, a question parked, a story owed;
 *   · and ONCE, a BLIP: the whole network gone for six seconds (the Wi-Fi dropped) — the poll, the socket, a press;
 *   · and ONCE, THE DECK ASLEEP: the page not painted for 6 – 17 s (`pageAway.ts` — the frame queue held; half the
 *     spells a hidden tab that says so, half a window behind another), wherever the walk stands.
 * `TM_E2E_AUTOPILOT_WEATHER`: `clear` · `storm` · `auto` (the default — one game in three is a storm).
 */
const WEATHER = process.env.TM_E2E_AUTOPILOT_WEATHER ?? 'auto';
/**
 * THE SLOW MACHINE (stage 6, total coverage — the kernel's announce machine had walked three of its six moves, never
 * an announce that came LATE): a handheld's CPU is not the box's. One game in five (`auto`, by the game's number — not
 * where `TM_E2E_CPU_THROTTLE` already slows every page) runs its page at a third of the speed (CDP's CPU throttling);
 * the product's motions and nets are right on a slow frame by construction (invariant 18), so a slow game's bar is the
 * same zero. `TM_E2E_AUTOPILOT_SLOW`: `auto` · `off` · a rate (`4`).
 */
const SLOW = process.env.TM_E2E_AUTOPILOT_SLOW ?? 'auto';
/**
 * THE OPENING THROUGH THE SCREEN (stage 6, total coverage — the box's 84 games never opened `scene:start-first-act`
 * nor `scene:first-action-rail`: every opening was answered over the API, so the start scene — the corporation, the
 * preludes, the buy, the first action — was a screen no game walked). In `auto` one game in four opens on the start
 * scene and the pilot walks it as a player does; `api` / `ui` force one way.
 */
const OPENING = process.env.TM_E2E_AUTOPILOT_OPENING ?? 'auto';
/**
 * THE CAMPAIGN (stage 6, total coverage — no game of the autopilot had sat at a campaign's mission: the «Тендеры»
 * mode's lots, played at the start and in the game, were screens no whole game walked). In `auto` one game in eight
 * is the SECOND mission of a «Тендеры» campaign of two humans (the first one committed over the dev door, the viewer's
 * seat granted three tenders in the catalog's rotation), its opening through the screen. `off` · `always`.
 */
const CAMPAIGN = process.env.TM_E2E_AUTOPILOT_CAMPAIGN ?? 'auto';
/** Game `n` sits at a campaign's mission. */
function campaignGame(n: number): boolean {
  return CAMPAIGN === 'always' || (CAMPAIGN === 'auto' && n % 8 === 5);
}

/**
 * THE SCENARIO TABLES (stage 6, total coverage — the input-type bar's gaps, derived from the code since 2026-11-27:
 * a choice no dealt game reaches in a whole pass; and the cards axis' residue — the cards of a requirement no dealt
 * game meets). A scenario is a FIXTURE — a real engine state, generated (`tests/e2e/fixtures/generate.ts`) and loaded
 * through the dev door — played from there TO ITS END by the same pilot, its other seats answered over the API like
 * any rival. The list and the cadence are the bottle's too (`autopilotDeal.scenarioFor`). `auto` · `off` · `always` ·
 * a scenario's name.
 */
const SCENARIO = process.env.TM_E2E_AUTOPILOT_SCENARIO ?? 'auto';
/** Game `n`'s scenario, or undefined (a table of its own). */
function scenarioOf(n: number): AutopilotScenario | undefined {
  return scenarioFor(n, SCENARIO);
}

/**
 * A CAMPAIGN's SECOND MISSION for game `n` — the table's expansions and board, two humans (the viewer «Alice», the
 * second seat «Bruno» answered over the API), «Тендеры»; mission 1 committed by the dev door with the viewer's three
 * tenders. Returns the mission's seats.
 */
async function campaignMission(request: APIRequestContext, n: number, table: {config: Record<string, unknown>}): Promise<{viewer: string, rivals: Array<string>, word: string}> {
  const config = campaignConfig({
    expansions: table.config.expansions, board: table.config.board, draftVariant: table.config.draftVariant, testMode: false,
    seed: table.config.seed, randomMA: table.config.randomMA, shuffleMapOption: table.config.shuffleMapOption,
  });
  // (A key of its own every run — the creator is idempotent by key, and a worker's server may outlive a run.)
  const key = `autopilot-${NAME}-${n}-${Math.floor(Math.random() * 1e9)}`;
  const created = await request.post('/api/campaign/create', {data: {key, name: 'Alice', config, options: {rewardMode: 'tenders', missionCount: 3}}});
  expect(created.ok(), `the campaign was not created: ${await created.text()}`).toBeTruthy();
  const id = String((await created.json() as {id: string}).id);
  await launchMission(request, id);
  const granted = [0, 1, 2].map((k) => TENDER_IDS[(n * 3 + k) % TENDER_IDS.length]);
  await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline'], 1: ['Helion']}, tenders: {0: granted}});
  const {yourPlayerId} = await launchMission(request, id);
  expect(yourPlayerId, 'the second mission seats the viewer').toBeTruthy();
  const bruno = (await campaignModelAs(request, id, 'Bruno')).missions[1]?.yourPlayerId;
  return {viewer: String(yourPlayerId), rivals: bruno === undefined ? [] : [bruno], word: `campaign mission 2 · tenders ${granted.join(', ')}`};
}
function slowRateOf(n: number): number {
  if (Number(process.env.TM_E2E_CPU_THROTTLE ?? 0) > 1 || SLOW === 'off') {
    return 1;
  }
  return SLOW === 'auto' ? (n % 5 === 2 ? 3 : 1) : Math.max(1, Number(SLOW) || 1);
}

/** The standard projects a visit of the grid goes to first — each opens a flow of its own (a colony, a tile, a scale). */
const SP_ROTATION: ReadonlyArray<string> = ['Build Colony', 'Aquifer', 'Greenery', 'City', 'Air Scrapping', 'Asteroid:SP', 'Power Plant:SP',
  'Buffer Gas', 'Excavate:SP', 'Sell Patents'];
const WEATHER_KINDS = ['lost', 'stale', 'busy', 'lost-answer'] as const;
type WeatherKind = typeof WEATHER_KINDS[number];
/** What the page honestly says of a fault the weather made — booked as the weather's, never as the game's log. */
const WEATHER_SAYS: Record<WeatherKind, ReadonlyArray<RegExp>> = {
  'lost': [/^\[net\] the submit — /],
  'lost-answer': [/^\[net\] the submit — /, /^400 POST \/player\/input/],
  'busy': [/^503 POST \/player\/input/, /^\[net\] the submit — the server answered 503/],
  'stale': [/^400 POST \/player\/input/],
};

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

/**
 * THE DEAL (stage 6, the cards axis — the owner, 2026-11-26: «покрывал АБСОЛЮТНО все игровые ситуации»): a random
 * deal brings a card to the pilot's hand when chance does, and the box's 84 games played what chance gave. In
 * `rotate` (the default) the cards of the premium scope come to the opening hand IN TURN — game `n` deals the next
 * five projects of the scope's list whose module its table plays, the next corporation and the next two preludes
 * (`customProjectCards` / `customCorporationsList` / `customPreludes`: on the top of their decks, the first seat's
 * deal), and the opening buys them. Over the games every card of the scope is dealt; the report sums which ones the
 * pilot then PLAYED (`scripts/autopilot-cards.mts` — the never-played list). `TM_E2E_AUTOPILOT_DEAL=missing` deals the
 * cards no whole game has played yet first (`autopilotDeal.UNPLAYED_CARDS`); `random` keeps the plain deal.
 */
const DEAL = process.env.TM_E2E_AUTOPILOT_DEAL ?? 'rotate';
/** The boards MarsBot plays on (`common/automa/automaCompatibility.ts`), by the names the creator sends. */
const BOARDS = ['tharsis', 'hellas', 'elysium', 'utopia planitia', 'terra cimmeria nova', 'vastitas borealis nova', 'vastitas borealis',
  'amazonis p.', 't. cimmeria', 'arabia terra', 'Hollandia'] as const;

/**
 * THE TABLE OF GAME `n` — what the creator's payload can say (`create/premium/buildCreateGamePayload.ts`): the
 * in-scope expansions under their dependencies (Redux needs Colonies, Prelude 2 needs Prelude), Solar Phase with Venus
 * and without the bot, no pre-game draft. Not `testMode`: a real game's economy and its real length.
 */
function tableOf(n: number): {config: Record<string, unknown>, word: string, duo: boolean, deal: Array<string>} {
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
  // (The modules the table plays, by the scope's keys: the base game and the Corporate Era always — `dealFor` adds
  // classic Turmoil with Redux.)
  // (Not a module list of the scope — the TABLE's: the expansions it seats, and the two every table plays.)
  const modules = new Set<string>(on);
  modules.add('base');
  modules.add('corpera');
  const deal = DEAL === 'rotate' || DEAL === 'missing' ? dealFor(n, modules, prelude, DEAL === 'missing' ? 'unplayed' : 'scope') : {projects: [], corporations: [], preludes: []};
  // THE RULES THE CREATOR SETS (stage 6, total coverage — `create/premium/buildCreateGamePayload.ts`: the random
  // milestones and awards, the fast mode, the others' points in real time, the shuffled map, the starting-TR bonus):
  // every switch a player can throw in the creator is a table some game sits at. Their own stream — the tables
  // drawn above stay the ones they were.
  const rules = rng(`${NAME}:${n}:rules`);
  const ruled = {
    randomMA: rules() < 0.3 ? 'All milestones and awards' : 'No randomization',
    fastModeOption: rules() < 0.25,
    showOtherPlayersVP: rules() < 0.5,
    shuffleMapOption: rules() < 0.3,
  };
  const boost = rules() < 0.2 ? 1 + Math.floor(rules() * 5) : 0;
  Object.assign(config, ruled);
  // (…and ONE MORE HUMAN at one table in five of those that already seat another — or none, beside MarsBot: the creator
  // seats one to four humans against the bot and up to five without it. A third seat is a foreign turn between two of
  // the viewer's, a second human beside the bot is the bot's attacks shared.)
  const seated = config.players as Array<Record<string, unknown>>;
  if ((duo || bot) && rules() < 0.2) {
    seated.push({name: duo ? 'Rival2' : 'Rival', color: duo ? 'green' : 'blue', beginner: false, handicap: 0, first: false});
  }
  if (boost > 0) {
    (config.players as Array<Record<string, unknown>>)[0].handicap = boost;
  }
  const said = [ruled.randomMA !== 'No randomization' ? 'random M&A' : '', ruled.fastModeOption ? 'fast' : '', ruled.showOtherPlayersVP ? 'VP shown' : '',
    ruled.shuffleMapOption ? 'shuffled map' : '', boost > 0 ? `TR +${boost}` : '', seated.length > (duo ? 2 : 1) ? `${seated.length} humans` : ''].filter((s) => s !== '');
  if (DEAL === 'rotate' || DEAL === 'missing') {
    Object.assign(config, {customProjectCards: deal.projects, customCorporationsList: deal.corporations, customPreludes: deal.preludes});
  }
  return {config, duo: seated.length > 1, deal: [...deal.corporations, ...deal.preludes, ...deal.projects],
    word: `${bot ? 'vs MarsBot' : duo ? 'duo' : 'solo'} · ${board} · ${on.join('+') || 'base'}${draft ? ' · draft' : ''}${said.length > 0 ? ` · ${said.join(' · ')}` : ''}`};
}

type Wire = {
  game: {phase: string, generation: number, gameAge: number, temperature?: number, oxygenLevel?: number, oceans?: number, venusScaleLevel?: number},
  thisPlayer?: {tableau?: Array<{name: string}>},
  waitingFor?: {
    type: string, promptId?: number, bonusActionPrompt?: unknown, title?: unknown, min?: number, max?: number, cards?: Array<unknown>,
    options?: Array<{type: string, warnings?: Array<string>, cards?: Array<{name: string, isDisabled?: boolean, calculatedCost?: number,
      standardProjectPreview?: {futile?: unknown}}>}>,
  } & Record<string, unknown>,
};

/**
 * THE STANDARD PROJECTS THAT TERRAFORM — what the rival seat plays when it can afford one: a duo table whose rival
 * only took the menu's first branch or passed did not terraform, and stood for 28 generations until the press budget
 * capped it (CI's autopilot, game 52). The table must reach its end for the walk to see the whole game.
 */
const TERRAFORMING_SP: ReadonlyArray<string> = ['Asteroid:SP', 'Aquifer', 'Greenery', 'Air Scrapping'];
/** The cards that are a TRADE's destination — a fleet dock in the trading grid (Turmoil Redux TR06 / TR26 / TR27). */
const DOCK_CARDS: ReadonlyArray<string> = ['Water Hauling', 'UNMI Liner', 'Aurora Station'];
/** The card ACTIONS a rival seat takes now and then — a move another console must SEE (Mars Nomads: the camp moved by another seat). */
const RIVAL_ACTIONS: ReadonlySet<string> = new Set(['Mars Nomads']);

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
  /** The heat-spending composite stands on screen (`.con-heat`). */
  heat: boolean,
  /** A FLEET DOCK stands in the trading grid (a card that is a trade's destination — Water Hauling), and whether the cursor is on one. */
  dock: {focused: boolean} | undefined,
  /** A budget composite's coverage meter (`[data-prompt-meter]` — «ПОКРЫТО done / of»), when one stands. */
  meter: {done: number, of: number} | undefined,
  /** The rows of a lanes plate (`.con-lanes__row`), as a player reads them: what each holds, its cap, what it pays, the focus. */
  lanes: Array<{value: number, max: number, pays: number, focused: boolean}>,
  /** The card under the cursor of a pick is already TAKEN (the hand's «✓», a slot's band) — or the pick refuses it. */
  focusTaken: boolean,
  /** The system alert stands (`.con-alert` — a refused / failed press, the server out of reach): its title. */
  alert: string | undefined,
  /** …and its message (what the alert says of the refusal). */
  alertBody: string,
  /** The hand's album in plain browse (a card to play): every slot — its card, playable or not, where it stands. */
  hand: {focused: number, cards: Array<{name: string, playable: boolean, page: number, row: number, col: number}>} | undefined,
  /** The standard projects' grid, when it stands in browse: the focused row and every row (its project, lit or not). */
  stdp: {focused: number, cards: Array<{name: string, go: boolean, futile: boolean}>} | undefined,
  /** The card actions' grid, when it stands in browse: the focused tile and every tile (lit or not) — a tile is «card#n». */
  actions: {focused: string, tiles: Array<{name: string, card: string, go: boolean}>} | undefined,
  /** A composer's variant choice, when one stands: its axis, the focused option and which options are live. */
  variants: {axis: string, focused: number, live: Array<boolean>} | undefined,
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

/**
 * THE GAME's OWN CARDS FIRST (stage 6 — the scenarios' first passes on the box, 2026-11-27: of the seven cards the
 * Parliament's table is FOR, the rotation's visits of the hand — two intents in ten — played two in fourteen
 * generations, and the flows they stand on stayed unopened): when the menu offers a card of the game's own list
 * (`dealt` — the deal, or a scenario's targets) to PLAY, the turn goes to the hand; when it offers one's ACTION, to
 * «Действия карт». Otherwise the rotation — `undefined`.
 */
function dealtIntents(options: ReadonlyArray<{type: string, cards?: ReadonlyArray<{name: string, isDisabled?: boolean}>}> | undefined,
  dealt: ReadonlyArray<string>, tableau: ReadonlyArray<string>): Array<number> {
  const offered = (type: string, played: boolean) => (options ?? []).filter((o) => o.type === type).flatMap((o) => o.cards ?? [])
    .some((c) => dealt.includes(c.name) && c.isDisabled !== true && (!played || tableau.includes(c.name)));
  const at = (name: string) => INTENTS.findIndex((i) => i.name === name);
  // (…and a STANDARD PROJECT of the list — a scenario's law that answers one, RX35's pick of the data card.)
  const project = (options ?? []).flatMap((o) => o.cards ?? []).some((c) => dealt.includes(c.name) && c.isDisabled !== true && SP_ROTATION.includes(c.name));
  // (…and a FLEET DOCK of the list in play — the trade goes to the grid, where the dock stands last.)
  const dock = dealt.some((name) => DOCK_CARDS.includes(name) && tableau.includes(name));
  // (A card's ACTION is a PLAYED card's — the menu's other card pick, «sell patents», lists the hand.)
  // (A project before an action: a law that answers a project stands until the next sitting — RX35 in force at the
  // banner's table was over before the rotation reached the grid.)
  return [
    ...(offered('projectCard', false) ? [at('hand')] : []), ...(project ? [at('standard-projects')] : []),
    ...(offered('card', true) ? [at('card-actions')] : []), ...(dock ? [at('trading')] : []),
  ];
}

/**
 * THE CARDS THE VIEWER's PLAYS LOGGED — `${0} played ${1}` (`Player.playCard`'s own line, its tokens a player and a
 * card), read generation by generation off the game's log (`/api/game/logs`: the default view is its last fifty lines).
 */
async function loggedPlays(request: APIRequestContext, viewer: string, color: string | undefined, generations: number): Promise<Array<string>> {
  const names: Array<string> = [];
  if (color === undefined) {
    return names;
  }
  for (let generation = 1; generation <= generations; generation++) {
    const res = await request.get(`/api/game/logs?id=${viewer}&generation=${generation}`).catch(() => undefined);
    const lines = res?.ok() === true ? await res.json() as Array<{message?: string, data?: Array<{type?: number, value?: string}>}> : [];
    for (const line of lines) {
      const [who, what] = line.data ?? [];
      if (line.message === '${0} played ${1}' && who?.type === LogMessageDataType.PLAYER && who.value === color &&
          what?.type === LogMessageDataType.CARD && what.value !== undefined) {
        names.push(what.value);
      }
    }
  }
  return names;
}

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
      heat: document.querySelector('.con-heat') !== null,
      dock: document.querySelector('.con-colonies__dockslot') === null ? undefined :
        {focused: document.querySelector('.con-colonies__dockslot--focused') !== null},
      hand: (() => {
        const slots = [...document.querySelectorAll('.con-hand__slot')];
        if (slots.length === 0 || !slots.some((s) => s.classList.contains('con-hand__slot--playable') || s.classList.contains('con-hand__slot--unplayable') ||
            s.classList.contains('con-hand__slot--notnow'))) {
          return undefined;
        }
        return {
          focused: slots.findIndex((s) => s.classList.contains('con-hand__slot--selected')),
          // (Where a card stands, by the album's own structure — its page, its row, its place in the row — never a
          // rect: the pilot reads the grid the way the cursor walks it.)
          cards: slots.map((s) => {
            const row = s.closest('.con-hand__row');
            const page = s.closest('.con-hand__page');
            const index = (el: Element | null, of: Element | null | undefined, selector: string): number =>
              el === null || of === null || of === undefined ? -1 : [...of.querySelectorAll(`:scope > ${selector}`)].indexOf(el);
            return {name: s.getAttribute('data-zoom-slot') ?? '', playable: s.classList.contains('con-hand__slot--playable'),
              page: index(page, page?.parentElement, '.con-hand__page'), row: index(row, page, '.con-hand__row'), col: index(s, row, '.con-hand__slot')};
          }),
        };
      })(),
      stdp: (() => {
        const cards = [...document.querySelectorAll('.con-stdp__browse:not(.con-stdp__browse--parked) .con-stdp__card')];
        return cards.length === 0 ? undefined : {
          focused: cards.findIndex((c) => c.classList.contains('con-stdp__card--focused')),
          cards: cards.map((c) => ({name: c.getAttribute('data-stdp-card') ?? '', go: c.classList.contains('con-stdp__card--go'),
            futile: c.hasAttribute('data-stdp-futile')})),
        };
      })(),
      variants: (() => {
        const choice = [...document.querySelectorAll<HTMLElement>('.con-composer .con-vchoice')].find((el) => el.offsetParent !== null);
        if (choice === undefined) {
          return undefined;
        }
        const opts = [...choice.querySelectorAll<HTMLElement>('.con-vchoice__opt')];
        return {axis: choice.getAttribute('data-variant-axis') ?? '', focused: opts.findIndex((o) => o.classList.contains('con-vchoice__opt--focused')),
          live: opts.map((o) => !o.classList.contains('con-vchoice__opt--off'))};
      })(),
      actions: (() => {
        const tiles = [...document.querySelectorAll<HTMLElement>('.con-cardactions .con-cardactions__tile')].filter((el) => el.offsetParent !== null);
        // (A tile is its card and its place among that card's tiles — a card of two actions stands as TWO tiles, its
        // variants: «Modular Floodgates#0» fabricates, «#1» deploys the blockade.)
        const seenOf = new Map<string, number>();
        const keyed = tiles.map((el) => {
          const card = el.getAttribute('data-action-card') ?? '';
          const at = seenOf.get(card) ?? 0;
          seenOf.set(card, at + 1);
          return {el, name: `${card}#${at}`, card};
        });
        return keyed.length === 0 ? undefined : {
          focused: keyed.find((k) => k.el.classList.contains('con-cardactions__tile--focused'))?.name ?? '',
          tiles: keyed.map((k) => ({name: k.name, card: k.card,
            go: k.el.classList.contains('con-cardactions__tile--available') || k.el.classList.contains('con-cardactions__tile--soft')})),
        };
      })(),
      alertBody: (document.querySelector('.con-alert__body')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
      alert: document.querySelector('.con-alert') === null ? undefined :
        (document.querySelector('.con-alert__title')?.textContent ?? '').trim().slice(0, 60),
      focusTaken: document.querySelector('.con-hand__slot--selected.con-hand__slot--select-picked, .con-hand__slot--selected.con-hand__slot--select-disabled, ' +
        '.con-cards__slot--focused.con-cards__slot--picked') !== null,
      meter: (() => {
        // (The meter of the plate that STANDS — a lanes plate first: a hidden composite elsewhere keeps its own.)
        const el = document.querySelector('.con-lanes [data-prompt-meter]') ?? document.querySelector('[data-prompt-meter]');
        const done = Number(el?.querySelector('b')?.textContent ?? 'NaN');
        const of = Number(/(\d+)/.exec(el?.querySelector('.con-prompt-outcome__meter-of')?.textContent ?? '')?.[1] ?? 'NaN');
        return el === null || Number.isNaN(done) || Number.isNaN(of) ? undefined : {done, of};
      })(),
      lanes: [...document.querySelectorAll('.con-lanes .con-lanes__row')].map((row) => ({
        value: Number(row.querySelector('.con-lanes__value')?.textContent ?? 'NaN'),
        max: Number(/(\d+)/.exec(row.querySelector('.con-lanes__of')?.textContent ?? '')?.[1] ?? 'NaN'),
        pays: Number(/(\d+)/.exec(row.querySelector('.con-lanes__pays')?.textContent ?? '')?.[1] ?? 'NaN'),
        focused: row.classList.contains('con-lanes__row--focused'),
      })).filter((row) => !Number.isNaN(row.value) && !Number.isNaN(row.max)),
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
  /** The SHAPES of the questions the screen answered (`questionShape`) — an axis of the coverage. */
  shapes: Record<string, number>,
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
/** The server's markers on a question (a draft, a deck pick, a start prompt, a choice's context — with its kind). */
function questionMarkers(wf: NonNullable<Wire['waitingFor']>): Array<string> {
  return Object.keys(wf).filter((key) => /(Prompt|Context|reveal)$/i.test(key) && wf[key] !== undefined && wf[key] !== null)
    .map((key) => {
      const kind = (wf[key] as {kind?: unknown, mode?: unknown, source?: {kind?: unknown}} | undefined);
      const of = kind?.kind ?? kind?.mode ?? kind?.source?.kind;
      return typeof of === 'string' ? `${key}:${of}` : key;
    }).sort();
}

/**
 * THE QUESTION's SHAPE — its type and the server's markers on it, nothing of its title or count: the axis of the
 * coverage that asks «which kinds of question has the screen answered» (`or:menu` for the action menu).
 */
function questionShape(wf: NonNullable<Wire['waitingFor']>, menu: boolean): string {
  const markers = questionMarkers(wf);
  return `${menu ? 'or:menu' : wf.type}${markers.length > 0 ? `[${markers.join(',')}]` : ''}`;
}

function questionWord(wf: NonNullable<Wire['waitingFor']>): string {
  const title = typeof wf.title === 'string' ? wf.title : String((wf.title as {message?: string} | undefined)?.message ?? '');
  const markers = questionMarkers(wf);
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
  rivals: ReadonlyArray<string> = [], storm?: {reloadAt: number, reloaded: boolean, blipAt: number, blipped: boolean, blip: () => Promise<void>,
    awayAt: number, awayDone: boolean, awayMs: number, awayHidden: boolean},
  dealt: ReadonlyArray<string> = []): Promise<Played> {
  const g = rng(`${seed}:pilot`);
  const rivalRng = rng(`${seed}:rival`);
  /**
   * THE OTHER HUMAN SEATS (a duo table): each answered over the API whenever it is asked — a pass now and then, else the
   * answer the harness knows for its question (`answerPrompt`), the pass when it knows none; a few in a row (a follow-up
   * asks the same seat again). Its moves reach this console as another player's: the foreign classes of the console.
   */
  const rivalStuck = new Set<number>();
  /** The seat's stock, as a payment reads it. */
  type Purse = {megacredits: number, heat: number, steel: number, titanium: number, steelValue?: number, titaniumValue?: number};
  const purseOf = async (seat: string): Promise<Purse> => (await fetchPlayerModel(request, seat) as unknown as {thisPlayer: Purse}).thisPlayer;
  /**
   * A PAYMENT FROM THE SEAT's OWN STOCK — M€ first, then what the prompt lets it spend (heat, steel, titanium) — and
   * its variants: the plain M€-first one, and the metals FIRST (a card a seat pays with steel it holds, M€ for the rest).
   * One builder for a payment prompt, a project's play and a standard project — each its own answers the server weighs.
   */
  const paymentsFor = (purse: Purse, amount: number, can: Record<string, boolean | undefined>): Array<Record<string, number>> => {
    const out: Array<Record<string, number>> = [];
    for (const metalsFirst of [false, true]) {
      let owed = amount;
      const pay: Record<string, number> = {...NO_PAYMENT};
      const metals = (): void => {
        for (const [unit, value] of [['steel', purse.steelValue ?? 2], ['titanium', purse.titaniumValue ?? 3]] as const) {
          if (owed > 0 && can[unit] === true) {
            const n = Math.min(purse[unit], Math.ceil(owed / value));
            pay[unit] = n;
            owed = Math.max(0, owed - n * value);
          }
        }
      };
      if (metalsFirst) {
        metals();
      }
      pay.megacredits = Math.min(purse.megacredits, owed);
      owed -= pay.megacredits;
      if (owed > 0 && can.heat === true) {
        pay.heat = Math.min(purse.heat, owed);
        owed -= pay.heat;
      }
      if (!metalsFirst) {
        metals();
      }
      if (!out.some((seen) => JSON.stringify(seen) === JSON.stringify(pay))) {
        out.push(pay);
      }
    }
    return out;
  };
  /** The rival's project tries (the response object → the project's name), and the projects whose refusal was named. */
  const spTries = new Map<unknown, string>();
  const spRefusedNamed = new Set<string>();
  /**
   * WHAT THE SECOND SEAT DID (the box's count on `b9254000a8`: five duo tables on the cap, the oceans at 1 – 7 for
   * sixty generations while the seat held 50 – 120 M€ — and no line said whether it ever stood on its action menu, or
   * what that menu offered): each answered move by its kind (`sp:<project>`, `pass`, `<type>#<option>`), and once a
   * generation, on the action menu, the terraforming projects it showed (`✓` lit, `✗` grey).
   */
  let rivalDid: Array<string> = [];
  const spSeenGen = new Set<number>();
  const rivalsMove = async (): Promise<number> => {
    let moves = 0;
    rivalDid = [];
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
        // (…EVERY terraforming project it can afford, in the server's order — a refused one is followed by the next, never
        // by a pass: the night count's duo tables stood on the cap with the oceans at 1 – 4 for forty generations, the
        // seat's one project try refused and its pass taken instead. The price is paid from its own stock, M€ first, and
        // a refusal is named once per project — `[RIVAL-SP-REFUSED …]`.)
        // (…and only a project that TERRAFORMS: the box's replay of game 2125 named the five capped duos' cause — the
        // seat bought «Астероид» every turn at +8 °C, the server's order putting it first, and its M€ never reached
        // the oceans. A project whose whole result is a maxed step is `standardProjectPreview.futile`; the seat takes
        // the others, in an order of its own.)
        const terraforms = (c: {name: string, isDisabled?: boolean, standardProjectPreview?: {futile?: unknown}}): boolean =>
          TERRAFORMING_SP.includes(c.name) && c.isDisabled !== true && c.standardProjectPreview?.futile === undefined;
        // (…and A CARD's ACTION of its own that another console must SEE — stage 6, `scene:nomad-move-remote`: the
        // rival's camp moved, the viewer's board telling the hop. Taken now and then, BEFORE a project; the move's cell
        // follows as the seat's next question, answered like any other.)
        const rivalAction = (c: {name: string, isDisabled?: boolean}): boolean => RIVAL_ACTIONS.has(c.name) && c.isDisabled !== true;
        const acting = options.findIndex((o) => o.type === 'card' && (o.cards ?? []).some(rivalAction));
        if (acting >= 0 && rivalRng() < 0.5) {
          const card = (options[acting].cards ?? []).find(rivalAction);
          if (card !== undefined) {
            tries.push({type: 'or', index: acting, response: {type: 'card', cards: [card.name]}});
          }
        }
        const projects = options.findIndex((o) => o.type === 'projectCard' && (o.cards ?? []).some(terraforms));
        const menuGen = pass >= 0 ? ((await fetchPlayerModel(request, rival)) as unknown as {game?: {generation?: number}}).game?.generation ?? 0 : 0;
        if (pass >= 0 && !spSeenGen.has(menuGen)) {
          spSeenGen.add(menuGen);
          const shown = options.flatMap((o) => (o.cards ?? []).filter((c) => TERRAFORMING_SP.includes(c.name)).map((c) => `${c.name}${c.isDisabled === true ? '✗' : '✓'}`));
          log.push(`[RIVAL-MENU g${menuGen}: ${shown.length > 0 ? shown.join(' ') : 'no terraforming project'} · ${options.map((o) => o.type).join(',')}]`);
        }
        if (projects >= 0 && rivalRng() < 0.8) {
          const purse = await purseOf(rival);
          const can = (options[projects] as {paymentOptions?: Record<string, boolean | undefined>}).paymentOptions ?? {};
          for (const project of (options[projects].cards ?? []).filter(terraforms).sort(() => rivalRng() - 0.5)) {
            for (const payment of paymentsFor(purse, project.calculatedCost ?? 0, can)) {
              const response = {type: 'or', index: projects, response: {type: 'projectCard', card: project.name, payment}};
              spTries.set(response, project.name);
              tries.push(response);
            }
          }
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
        // A PAYMENT the seat cannot make in M€ alone (CI's game 246 replayed on the box — «Select how to pay N M€ for the
        // trade fleet», refused at M€ 8: the seat had fewer): its own stock, M€ first, then what the prompt lets it spend.
        if (asked.type === 'payment') {
          const can = (asked as {paymentOptions?: Record<string, boolean | undefined>}).paymentOptions ?? {};
          for (const payment of paymentsFor(await purseOf(rival), (asked as {amount?: number}).amount ?? 0, can)) {
            tries.push({type: 'payment', payment});
          }
        }
        // A CARD TO PLAY that the prompt itself asks for (CI's game 2123 on the box — STUCK: «Play a card ignoring its
        // global requirements (Live Experiments)», the harness's one answer refused): every card it offers, each paid
        // from the seat's stock in both orders, until the server takes one.
        if (asked.type === 'projectCard') {
          const purse = await purseOf(rival);
          const can = (asked as {paymentOptions?: Record<string, boolean | undefined>}).paymentOptions ?? {};
          for (const card of ((asked as {cards?: Array<{name: string, isDisabled?: boolean, calculatedCost?: number}>}).cards ?? []).filter((c) => c.isDisabled !== true)) {
            for (const payment of paymentsFor(purse, card.calculatedCost ?? 0, {...can, steel: true, titanium: true})) {
              tries.push({type: 'projectCard', card: card.name, payment});
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
            const r = response as {type?: string, index?: number};
            rivalDid.push(spTries.has(response) ? `sp:${spTries.get(response)}` :
              r.type === 'or' && r.index === pass ? 'pass' :
                `${asked.type}${r.type === 'or' && r.index !== undefined ? `#${r.index}` : ''}`);
            break;
          } catch (e) {
            // the server refused this one — the next (its word kept: a stuck seat names why)
            // (…the server's own word — what follows the payload: «… : 400 {"message": …}».)
            const said = String((e as Error).message ?? e).split('\n').find((line) => /rejected/.test(line)) ?? '';
            refused = (/: (\d{3} .*)$/.exec(said)?.[1] ?? said).slice(0, 220);
            const sp = spTries.get(response);
            if (sp !== undefined && !spRefusedNamed.has(sp)) {
              spRefusedNamed.add(sp);
              log.push(`[RIVAL-SP-REFUSED ${sp}: ${refused.replace(/^.*?: (\d{3})/, '$1').slice(0, 160)}]`);
            }
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
    // THE PAGE SEES THE OTHER SEAT's MOVES BEFORE THE PILOT PRESSES (the night count's game 2009: three API moves of
    // the second seat, the pilot's A on «Закрыть заседание» a tenth of a second later — answered against the prompt
    // the page still held, refused `STALE_PROMPT` (400), as the server's gate is built to). Two people at a table do
    // not press inside the other's network round trip on every move; the harness made that the rule. Bounded: a page
    // still behind after it is named (`[PAGE-BEHIND]`) — a view held behind a story is the product's question.
    if (moves > 0) {
      await syncClient(page, request, viewer, {timeoutMs: 5_000}).catch(() => {
        log.push('[PAGE-BEHIND]');
      });
    }
    return moves;
  };
  const started = Date.now();
  const played: Played = {end: 'capped', presses: 0, generation: 0, phase: '', byUi: {}, byApi: {}, passes: {ui: 0, api: 0}, doors: [], tookMs: 0, soak: [], spells: [], shapes: {}};
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
    // A HOLD IS HELD (CI's autopilot on `4d74b4f9a0`, game 582 — the door on «A Разыграть без эффекта»: a prelude whose
    // effect cannot happen commits by a HOLD, the safe default, and the pilot's fourteen taps never completed it). The
    // bar draws a hold's ring around its glyph (`.con-cmdbar__hold`): a player keeps that button down until the ring
    // closes — the pilot too, for the ring's time and a margin (`HOLD_CONFIRM_MS`, 700 ms at the standard pace).
    const holds = await page.evaluate((glyphs) => [...document.querySelectorAll('.con-cmdbar__cmd:not(.con-cmdbar__cmd--disabled) .con-cmdbar__hold .gp-glyph')]
      .map((glyph) => glyphs[(glyph.textContent ?? '').trim()]).filter((k): k is string => k !== undefined), GLYPH_KEY).catch(() => [] as Array<string>);
    if (holds.includes(key)) {
      log.push('[HOLD]');
      await page.keyboard.down(key);
      await cinematicBeat(page, 1_400, 'a hold — a player keeps the button down until its ring closes');
      await page.keyboard.up(key);
    } else {
      await page.keyboard.press(key);
    }
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
    heldAway: number,
    /** How many times a prelude's «Разыграть без эффекта» confirm stood before the pilot (see «A PRELUDE PLAYED WITHOUT ITS EFFECT»). */
    noEffect?: number,
    /** Presses spent walking the start's projects step to the dealt cards (bounded — «THE CARDS THE GAME IS FOR»). */
    startTargetTries: number,
    /** The question was COLLAPSED once past its commit (see «THE INTERRUPTION») — once a question is enough. */
    collapsed: boolean,
    /** Its shape (`questionShape`) — summed when it is answered. */
    shape: string,
    /** The standard project this visit of the grid goes to (see «THE PROJECT A TURN GOES TO»). */
    stdpTarget: string | undefined,
    /** The card of the hand this visit goes to play (see «THE CARD A TURN PLAYS»). */
    handTarget: string | undefined,
    /** The card action this visit of the grid takes (see «THE ACTION A TURN TAKES»). */
    actionTarget: string | undefined,
    /** Presses this visit of the trading grid has walked toward a fleet dock (see «THE DOCK A TRADE GOES TO»). */
    dockSteps: number,
    /** The variant this question's composer takes, and whether it was taken (see «THE VARIANT A TURN CHOOSES»). */
    variantTarget: number | undefined, variantChosen: boolean} | undefined;
  /** The standard projects' visits of the game so far — the projects' rotation (`SP_ROTATION`). */
  let stdpVisits = 0;
  /** The turns the game's own cards chose the intent of (`dealtIntents` — its roads in turn). */
  let ownTurns = 0;
  /** The start's last press gave a card back (see «THE START SCENE»). */
  let startTrimmed = false;
  let stdpSteps = 0;
  let handSteps = 0;
  /** The card actions' visits, the walk's steps to the target, and its last step (the focus it stood on, the key). */
  let actionVisits = 0;
  let actionSteps = 0;
  let actionLast = {focus: '', key: ''};
  /** The composers' variant choices of the game so far (their rotation) and the walk's steps to the one taken. */
  let variantVisits = 0;
  let variantSteps = 0;
  /** The menus of the game so far — the intents' rotation (seeded by the game's own number, so two games start apart). */
  let menus = Math.floor(g() * INTENTS.length);
  /** The tableau's length at the last look (-1 before the first: the opening's cards are no play of the walk). */
  let seenTableau = -1;
  let moved = {age: -1, at: Date.now()};
  let sampledGeneration = 0;
  while (played.presses < PRESSES && !page.isClosed()) {
    // THE WEATHER's RELOAD (a storm game, once — see `WEATHER`): between two presses, whatever stands.
    if (storm !== undefined && !storm.reloaded && played.presses >= storm.reloadAt) {
      storm.reloaded = true;
      log.push(`[WEATHER reload at ${played.presses}]`);
      await reloadConsole(page);
      continue;
    }
    if (storm !== undefined && !storm.awayDone && played.presses >= storm.awayAt) {
      storm.awayDone = true;
      const said = await awayFromConsole(page, storm.awayMs, storm.awayHidden, 'the weather — the Deck put to sleep, by design');
      log.push(`[WEATHER away ${storm.awayMs} ms ${storm.awayHidden ? 'hidden' : 'behind'} at ${played.presses} — ${said.visibility}${said.starved !== undefined ? ` · starved ${said.starved}` : ''}]`);
      continue;
    }
    if (storm !== undefined && !storm.blipped && played.presses >= storm.blipAt) {
      storm.blipped = true;
      log.push(`[WEATHER blip at ${played.presses}]`);
      await storm.blip();
      continue;
    }
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
      // (…and the second seat's purse and rating: a seat that cannot afford a project is not one that refuses it.)
      const seats = await Promise.all(rivals.map(async (rival) => {
        const wire = await fetchPlayerModel(request, rival) as unknown as {thisPlayer: {megacredits: number, terraformRating: number, heat: number}, waitingFor?: Wire['waitingFor']};
        const them = wire.thisPlayer;
        // (…and what its menu offers of the terraforming projects, `✓` / `✗` — a seat with the M€ that never tries one.)
        const sp = (wire.waitingFor?.options ?? []).flatMap((o) => (o.cards ?? []).filter((c) => TERRAFORMING_SP.includes(c.name))
          .map((c) => `${c.name}${c.isDisabled === true ? '✗' : '✓'}${o.type === 'projectCard' ? '' : `(${o.type})`}`));
        return ` · R ${them.megacredits}M€ ${them.heat}h TR${them.terraformRating}${wire.waitingFor === undefined ? '' : ` asked ${wire.waitingFor.type}`}${sp.length > 0 ? ` sp[${sp.join(' ')}]` : ''}`;
      }));
      log.push(`[GEN ${g.generation} · T${g.temperature ?? '?'} · O${g.oxygenLevel ?? '?'} · W${g.oceans ?? '?'}${g.venusScaleLevel === undefined ? '' : ` · V${g.venusScaleLevel}`}${seats.join('')}]`);
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
        if (!standing.byApi) {
          bump(played.shapes, standing.shape);
        }
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
          log.push(`[RIVAL×${moves} ${rivalDid.join(',')}]`);
          continue;
        }
      }
      await press(g() < 0.5 ? pilotPick(await look(page), g, lastKey) : 'ArrowDown', 500 + Math.round(g() * 700));
      continue;
    }
    if (standing === undefined || standing.promptId !== wf.promptId) {
      if (standing !== undefined) {
        bump(standing.byApi ? played.byApi : played.byUi, standing.menu ? 'or:menu' : standing.type);
        if (!standing.byApi) {
          bump(played.shapes, standing.shape);
        }
      }
      const menu = wf.type === 'or' && (wf.options ?? []).some((o) => o.type === 'option' && o.warnings?.includes('pass') === true);
      // (Pilot 2: three menus in four have an INTENT — the turn goes to one section and plays there; the budget is
      // then never shorter than the way in and a few presses inside.)
      // A BONUS ACTION's MENU (the server's marker — «Фора»'s two actions, a card's granted one) is an action menu
      // with NO PASS: the player must act. The pilot read it as a question the screen does not answer and thumbed
      // the board for forty-five presses until the door acted for it (the third hundred's game 906). It is a turn
      // like any other — always with an intent, and a second one when the first led nowhere.
      const bonus = PILOT >= 2 && wf.type === 'or' && !menu && wf.bonusActionPrompt !== undefined;
      // (…never on the START's own menu — the corporation's first action owed, `startGamePrompt`: its stage is the start's
      // «A Выполнить первое действие», and an intent there minimized the opening on its way to another section — the
      // scenario of Lotus Innovations played its rail's scene nowhere.)
      const opening = wf.startGamePrompt !== undefined;
      // (THE CARD THE GAME IS FOR IS NOT PASSED BY — the cards axis' scenarios, a family of cards whose requirement the
      // sitting or the generation closes: a menu with one of the game's cards playable in the hand always has an intent,
      // is never passed at once and stands at least the way to the card and its composer — the window shut on half the
      // hand of menus gone by.)
      const handOwed = PILOT >= 3 && menu && !opening && dealtIntents(wf.options, dealt, []).includes(INTENTS.findIndex((i) => i.name === 'hand'));
      const intentful = PILOT >= 2 && (bonus || (menu && !opening && (g() < 0.75 || handOwed)));
      // (…each in turn when the game's cards ask several roads — the hand, an action, the dock.)
      const own = intentful ? dealtIntents(wf.options, dealt, (model.thisPlayer?.tableau ?? []).map((c) => c.name)) : [];
      const ownCards = own.length === 0 ? undefined : own[ownTurns++ % own.length];
      const intentAt = ownCards ?? menus++ % INTENTS.length;
      const intent = intentful ? [...INTENTS[intentAt].keys] : [];
      // (…and the start's own menu is never passed at once: its first action is what the opening is for.)
      const budget = bonus ? 60 : opening ? 30 : menu ? (g() < (handOwed ? 0 : intentful ? 0.05 : 0.18) ? 0 :
        Math.max(handOwed ? 45 : 0, (intentful ? 9 : 4) + Math.floor(g() * 23))) : 45;
      standing = {promptId: wf.promptId, type: wf.type, menu, bonus, presses: 0, budget, byApi: false, intent: budget > 0 ? intent : [], intentful: intentful && budget > 0, still: 0, lastStood: '', heldAway: 0, collapsed: false, startTargetTries: 0,
        shape: questionShape(wf, menu), stdpTarget: undefined, handTarget: undefined, actionTarget: undefined, dockSteps: 0,
        variantTarget: undefined, variantChosen: false};
      if (standing.intent.length > 0) {
        log.push(`[INTENT ${INTENTS[intentAt].name}${ownCards !== undefined ? ' — the game\'s own card' : ''}]`);
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
        log.push(`[RIVAL×${moves} ${rivalDid.join(',')}]`);
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
    // THE SYSTEM ALERT (a press the network or the server let down — the weather's, or a defect's in clear weather):
    // a player reads it and presses A. Named in the walk, so a clear game's alert is a line to read.
    if (seen.alert !== undefined) {
      log.push(`[ALERT ${seen.alert}${seen.alertBody !== '' ? ` — ${seen.alertBody}` : ''}]`);
      await press('Enter', 600 + Math.round(g() * 900));
      continue;
    }
    stood = `${seen.frames.join('>') || '-'}${seen.zoom ? '+ZOOM' : ''}${seen.quick ? '+WHEEL' : ''}|${wf.type}#${wf.promptId ?? ''}|${seen.bar.slice(0, 80)}` +
      `${seen.meter === undefined ? '' : `|m${seen.meter.done}/${seen.meter.of}`}`;
    // THE TURN's INTENT (pilot 2): from the board home, the wheel that leads to the section and the press that enters
    // it — one after the other, nothing between.
    if (standing.intent.length > 0) {
      if (standing.presses === 1) {
        await walkHome(false);
      }
      await press(standing.intent.shift() as string, 500 + Math.round(g() * 400));
      continue;
    }
    // THE START SCENE, WALKED AS A PLAYER WALKS IT (the opening through the screen — the first such game on the box,
    // 2403, toggled the cards on and off and stepped BACK with LT until the door answered): a card under the cursor
    // not yet taken is taken (A «Выбрать»); a taken one is passed by, or the step is done (RT «След. шаг», lit) —
    // a player takes one card or a few; a lone verb on the bar (the summary's launch, «Пропустить») is pressed. Never
    // LT (the step before) nor B: an opening goes forward.
    if (PILOT >= 3 && wf.type === 'initialCards' && /^start:/.test(seen.frames[seen.frames.length - 1] ?? '') && seen.look === '' && !seen.zoom) {
      // THE CARDS THE GAME IS FOR ARE BOUGHT FIRST (the bottle's rule, stage 6 — the cards axis): on the projects step a
      // dealt card not yet taken is walked to and taken before the step's RT (lit at zero cards) moves on.
      if (dealt.length > 0 && standing.startTargetTries < 40) {
        const step = await page.evaluate((names) => {
          // (…on every step of the opening that deals a card: the corporation, the preludes, the projects.)
          const here = document.querySelector('.con-start .con-cards__slot--focused[data-step-slot]');
          const id = (here?.getAttribute('data-step-slot') ?? '').split('|')[0];
          if (here === null || !['projects', 'corp', 'prelude'].includes(id)) {
            return {owed: 0, onOwed: false};
          }
          const slots = [...document.querySelectorAll(`.con-start .con-cards__slot[data-step-slot^="${id}|"]`)];
          const owed = slots.filter((el) => names.includes((el.getAttribute('data-step-slot') ?? '').slice(id.length + 1)) && !el.classList.contains('con-cards__slot--picked'));
          return {owed: owed.length, onOwed: owed.includes(here)};
        }, [...dealt]);
        if (step.owed > 0) {
          standing.startTargetTries++;
          await press(step.onOwed ? 'Enter' : 'ArrowRight', pause());
          continue;
        }
      }
      const nextLit = seen.offered.some((o) => o.key === 'Period');
      // (…a taken card with the step's RT not lit — a buy over the purse, a pick over its count: one card given back now
      // and then, as a player trims the pile.)
      // (…and a card just given back is passed by, never taken again at once: a step that wants EXACTLY two stands without
      // its RT at one card taken as much as at all of them.)
      const taken = seen.bar.includes('AСнять выбор');
      // (A step's row ends — a → that does not move is answered by ← or a row away.)
      const roll = g();
      const move = roll < 0.55 ? 'ArrowRight' : roll < 0.85 ? 'ArrowLeft' : roll < 0.93 ? 'ArrowDown' : 'ArrowUp';
      const key: string = taken ? (nextLit ? (g() < 0.6 ? 'Period' : move) : (g() < 0.2 ? 'Enter' : move)) :
        seen.bar.includes('AВыбрать') ? (startTrimmed ? move : 'Enter') :
          nextLit ? 'Period' : seen.offered.some((o) => o.key === 'Enter') ? 'Enter' : move;
      startTrimmed = taken && key === 'Enter';
      await press(key, pause());
      continue;
    }
    // THE DOCK A TRADE GOES TO (stage 6 — the autopilot's ledger: the fleet dock's scene, `scene:fleet-dock-scene`, never
    // opened — on the trading grid the thumb pressed the colony under the cursor, and the docks stand LAST in its reading
    // order). On a visit of the grid with a dock of the game's own list standing (`dealt` — Water Hauling's table), the
    // cursor walks on to the dock (→, the grid's one slot index) and A trades there; bounded, once a visit.
    if (PILOT >= 3 && (standing.menu || standing.bonus) && seen.dock !== undefined && seen.look === '' && !seen.zoom &&
        /^colonies:browse/.test(seen.frames[seen.frames.length - 1] ?? '') && dealt.some((name) => DOCK_CARDS.includes(name)) && standing.dockSteps < 14) {
      standing.dockSteps++;
      if (standing.dockSteps === 1) {
        log.push('[DOCK]');
      }
      await press(seen.dock.focused ? 'Enter' : 'ArrowRight', pause());
      if (seen.dock.focused) {
        standing.dockSteps = 14;
      }
      continue;
    }
    // THE PROJECT A TURN GOES TO (stage 6, total coverage — the box's 84 games never opened a colony's build: no
    // `scene:colony-city`, no `colony-roster`, no track's raise — a thumb in the standard projects' grid pressed
    // whatever row stood under it). On a visit of the grid the pilot goes to ONE project, in rotation over the ones
    // the grid lights (`SP_ROTATION` first — the projects that open a flow of their own), and presses it.
    if (PILOT >= 3 && (standing.menu || standing.bonus) && seen.stdp !== undefined && seen.look === '' && !seen.zoom && seen.stdp.focused >= 0) {
      const grid = seen.stdp;
      if (standing.stdpTarget === undefined || (standing.stdpTarget !== '' && !grid.cards.some((c) => c.name === standing?.stdpTarget && c.go))) {
        stdpSteps = 0;
        // (…a project that changes something first — the table goes on to its end; a futile one, the row that says so,
        // is still taken now and then: the last of the rotation.)
        const lit = grid.cards.filter((c) => c.go && !c.futile).map((c) => c.name);
        const futile = grid.cards.filter((c) => c.go && c.futile).map((c) => c.name);
        // (…the game's own projects FIRST — a scenario's `dealt`: the one its law answers.)
        const rotation = [...SP_ROTATION.filter((name) => dealt.includes(name)), ...SP_ROTATION.filter((name) => !dealt.includes(name))];
        const order = [...rotation.filter((name) => lit.includes(name)), ...lit.filter((name) => !SP_ROTATION.includes(name)), ...futile.slice(0, 1)];
        standing.stdpTarget = order.length === 0 ? undefined : order[stdpVisits++ % order.length];
        if (standing.stdpTarget !== undefined) {
          log.push(`[SP ${standing.stdpTarget}]`);
        }
      }
      const at = standing.stdpTarget === undefined || standing.stdpTarget === '' ? -1 : grid.cards.findIndex((c) => c.name === standing?.stdpTarget);
      // (…bounded: a grid laid out otherwise than the two columns read here is left to the thumb after a dozen steps.)
      if (at >= 0 && ++stdpSteps > 12) {
        standing.stdpTarget = '';
      } else if (at >= 0) {
        // (A grid of two columns: a row, then a column — one step a press.)
        const [row, col, toRow, toCol] = [Math.floor(grid.focused / 2), grid.focused % 2, Math.floor(at / 2), at % 2];
        await press(toRow > row ? 'ArrowDown' : toRow < row ? 'ArrowUp' : toCol > col ? 'ArrowRight' : toCol < col ? 'ArrowLeft' : 'Enter', pause());
        continue;
      }
    }
    // THE CARD A TURN PLAYS (stage 6, total coverage — the cards axis: a card dealt is a card to PLAY). On a visit of the
    // hand's album the pilot goes to ONE playable card — the deal's first (`dealt`, the scope's rotation), else one in
    // turn — walks the cursor to it by where it stands (a row, then along it) and presses A.
    // (…on a BONUS action's menu too — «Фора»'s two actions are turns like any other: the three targeted rules read
    // `standing.menu` alone, a bonus menu is `standing.bonus`, and the box's game 2821 thumbed the hand it had opened —
    // «A Разыграть» lit over a playable Virus — until the door played it.)
    if (PILOT >= 3 && (standing.menu || standing.bonus) && seen.hand !== undefined && seen.look === '' && !seen.zoom && seen.hand.focused >= 0 &&
        /^hand:browse/.test(seen.frames[seen.frames.length - 1] ?? '')) {
      const album = seen.hand;
      const playable = album.cards.filter((c) => c.playable).map((c) => c.name);
      if (standing.handTarget === undefined || (standing.handTarget !== '' && !playable.includes(standing.handTarget))) {
        handSteps = 0;
        // (…in the order of the game's own list — a scenario's card whose window closes first stands first.)
        const wanted = playable.filter((name) => dealt.includes(name)).sort((x, y) => dealt.indexOf(x) - dealt.indexOf(y));
        standing.handTarget = wanted[0] ?? (playable.length === 0 ? '' : playable[Math.floor(g() * playable.length)]);
        if (standing.handTarget !== '') {
          log.push(`[HAND ${standing.handTarget}]`);
        }
      }
      const at = standing.handTarget === '' ? -1 : album.cards.findIndex((c) => c.name === standing?.handTarget);
      if (at >= 0 && ++handSteps > 16) {
        standing.handTarget = '';
      } else if (at >= 0) {
        const [from, to] = [album.cards[album.focused], album.cards[at]];
        await press(to.page !== from.page ? (to.page > from.page ? 'ArrowRight' : 'ArrowLeft') :
          to.row !== from.row ? (to.row > from.row ? 'ArrowDown' : 'ArrowUp') :
            to.col !== from.col ? (to.col > from.col ? 'ArrowRight' : 'ArrowLeft') : 'Enter', pause());
        continue;
      }
    }
    // THE ACTION A TURN TAKES (stage 6, total coverage — the input-type bar's gaps: a choice only a blue card's action
    // asks — Dutch Mountains' stage reward, Modular Floodgates' blockade — no thumb pressing whatever tile stood under
    // it had reached in a whole pass). On a visit of «Действия карт» the pilot goes to ONE lit action — a card of the
    // game's own list first (`dealt`: the deal, or the scenario's targets), else one in turn — walks the cursor to it
    // (along the grid, turning at a wall, bounded) and presses A.
    if (PILOT >= 3 && (standing.menu || standing.bonus) && seen.actions !== undefined && seen.look === '' && !seen.zoom && seen.actions.focused !== '' &&
        /^card-actions:browse/.test(seen.frames[seen.frames.length - 1] ?? '')) {
      const lit = seen.actions.tiles.filter((tile) => tile.go).map((tile) => tile.name);
      if (standing.actionTarget === undefined || (standing.actionTarget !== '' && !lit.includes(standing.actionTarget))) {
        actionSteps = 0;
        const wanted = lit.filter((name) => dealt.includes(name.replace(/#\d+$/, '')));
        const from = wanted.length > 0 ? wanted : lit;
        standing.actionTarget = from.length === 0 ? '' : from[actionVisits++ % from.length];
        if (standing.actionTarget !== '') {
          log.push(`[ACTION ${standing.actionTarget}]`);
        }
      }
      if (standing.actionTarget !== '' && seen.actions.focused !== standing.actionTarget && ++actionSteps > 20) {
        standing.actionTarget = '';
      } else if (standing.actionTarget !== '' && seen.actions.focused !== standing.actionTarget) {
        // (The tiles stand in the grid's own order — the model's flat order, the rows packed left to right: toward the
        // target's index along a row, and across rows where a row ends — a step along it that moved nothing.)
        const names = seen.actions.tiles.map((tile) => tile.name);
        const forward = names.indexOf(standing.actionTarget) > names.indexOf(seen.actions.focused);
        const along = forward ? 'ArrowRight' : 'ArrowLeft';
        const across = forward ? 'ArrowDown' : 'ArrowUp';
        const stuck = seen.actions.focused === actionLast.focus && actionLast.key === along;
        const key = stuck ? across : along;
        actionLast = {focus: seen.actions.focused, key};
        await press(key, pause());
        continue;
      } else if (standing.actionTarget !== '') {
        await press('Enter', pause());
        continue;
      }
    }
    // THE VARIANT A TURN CHOOSES (stage 6, total coverage — the same gap from the other side: seven visits of Modular
    // Floodgates on the scenario's first pass, every one of them its variant A, the thumb pressing whatever variant stood
    // focused). A composer's variants are taken IN TURN, by the game's own count of them: the pilot walks the focus to
    // the live variant whose turn it is (along the choice's own axis, bounded) and presses A once — the rest of the
    // composer is the walk's.
    if (PILOT >= 3 && seen.variants !== undefined && seen.look === '' && !seen.zoom && seen.variants.focused >= 0 && !standing.variantChosen) {
      const live = seen.variants.live.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
      if (standing.variantTarget === undefined) {
        standing.variantTarget = live.length === 0 ? -1 : live[variantVisits++ % live.length];
        variantSteps = 0;
      }
      const target = standing.variantTarget;
      if (target >= 0 && seen.variants.focused !== target && ++variantSteps <= 8) {
        const forward = target > seen.variants.focused;
        await press(seen.variants.axis === 'column' ? (forward ? 'ArrowDown' : 'ArrowUp') : (forward ? 'ArrowRight' : 'ArrowLeft'), pause());
        continue;
      }
      standing.variantChosen = true;
      if (target >= 0 && seen.variants.focused === target) {
        log.push(`[VARIANT ${target}]`);
        await press('Enter', pause());
        continue;
      }
    }
    // THE INTERRUPTION (stage 6, total coverage — the kernel's frame machine had walked 18 of its 35 moves, never a frame
    // past its commit set OFF STAGE and brought back: `committed → *.away`, `completing.away → …`). A player who has
    // committed a move and wants the board folds the workspace («B Свернуть» — the decision stays live) and comes back
    // to it by its plate («A Вернуться»). Once a question, on one in four of those that offer it past the commit.
    if (PILOT >= 3 && !standing.collapsed && seen.look === '' && !seen.zoom && seen.bar.includes('BСвернуть') &&
        seen.frames.some((f) => /:(committed|completing|executing)/.test(f)) && g() < 0.25) {
      standing.collapsed = true;
      log.push('[COLLAPSE]');
      await press('Escape', pause());
      continue;
    }
    // THE LAYOUT OF A LOSS (pilot 2): a unit off the focused row, another, the next row, and «Принять убыток» — until
    // the server has the answer.
    if (PILOT >= 2 && wf.type === 'productionToLose' && seen.prodLoss && seen.look === '' && !seen.zoom) {
      await press((['Enter', 'Enter', 'ArrowDown', 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // THE HAZARD THRESHOLDS (stage 6 — `aresGlobalParameters`, Butterfly Effect: CI's browser on `1c0976df77` met it
    // twice, and the door answered both — «LB −1 · RB +1 · X Применить», no «A», no meter): a step on the focused row,
    // the next row, a step back, and the apply — a player trying the thresholds, then committing. (On its own screen
    // only: at home, with the question set aside, X is the table's «Разыграно».)
    if (PILOT >= 3 && wf.type === 'aresGlobalParameters' && seen.bar.includes('Применить') && seen.look === '' && !seen.zoom) {
      await press((['KeyE', 'ArrowDown', 'KeyQ', 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // THE COMPOSITES WHOSE COMMIT IS NOT «A» — read BEFORE the home's wait below, which takes a bar with no «A» for a
    // question the screen does not answer and only nudges the stick (the night count's game 1826: «Распределение
    // ресурсов · LB/RB −1 / +1 · X Забрать», the pilot nudged the stick until the door answered).
    // THE HEAT SPENT AS M€ (pilot 3 — the fifth hundred's first doors, thirteen of them on one question): the composite
    // asks «how much heat»: RT takes the most a lane may, X pays once the bill is covered, the next lane when one lane
    // does not cover it (A on the one-step layout) — a player reads all of it off the bar. ONLY ON ITS OWN SCREEN: read
    // at home with the question set aside, its X was «Разыграно» — the pilot opened its own table over the way back
    // (the new count's seven doors, a regression of the reorder above).
    // EVERY BUDGET COMPOSITE (the heat, a payment's lanes, the Venus bonus — the box's count on `b9254000a8`: twelve
    // doors on «… X Оплатить» left grey): its meter says what is owed, and a player lays the lanes out by it — the bill
    // paid (X lit) is paid; short of it, the rest poured onto the lane in focus (RT, A in the one-step layout) and the
    // next lane; over it — or a lane one unit too many (the cover rule refuses a redundant unit) — a unit taken back
    // (LB, A) and the next lane. A cycle of RT / X alone never left an over-covered bill.
    if (PILOT >= 3 && seen.meter !== undefined && seen.look === '' && !seen.zoom &&
        (seen.offered.some((o) => o.key === 'KeyX') || seen.greyed.includes('KeyX'))) {
      const dial = seen.offered.some((o) => o.key === 'Period') || seen.greyed.includes('Period');
      // (…and a bill the lanes cannot cover by pouring alone — the box's game 2313 on the new harness: a floater pays
      // 2 heat, the rest was 1, RT poured nothing and the pilot walked RT / ↓ until the door answered; the cover is
      // heat 2 + a floater, a unit taken OFF one lane first. Short of it, the pilot pours (RT), adds (RB), takes back
      // (LB) or moves on (↓) — a player trying the lanes; over it, takes back.)
      // (…and a layout with no RT that steps by LB / RB — «Распределение ресурсов», CI's game on `6593366912`: four
      // doors, A and ↓ pressed where a unit is added by RB.)
      const roll = g();
      const steps = seen.offered.some((o) => o.key === 'KeyE') || seen.greyed.includes('KeyE');
      // …AND IT READS THE ROWS, as a player lays a bill out (CI's autopilot on `4d74b4f9a0`, game 546 — «Select how to
      // spend 8 heat», the heat row and a floater row worth 2: the walk above stood 7 ↔ 9 until the door answered). Over
      // the bill by k: a unit off the row whose unit is k, else off the smallest. Short of it: a unit where it fits (a
      // unit no larger than what is owed, or a row not yet read), else onto any row with room — then the overshoot comes
      // back off the smallest. The cursor walks to the row first (↓ / ↑ along the rows).
      const rows = seen.lanes;
      const at = rows.findIndex((r) => r.focused);
      if (steps && !seen.offered.some((o) => o.key === 'KeyX') && rows.length > 0 && at >= 0 && seen.meter.done !== seen.meter.of) {
        const unitOf = (r: {value: number, pays: number}): number | undefined => (r.value > 0 && !Number.isNaN(r.pays) ? r.pays / r.value : undefined);
        const over = seen.meter.done - seen.meter.of;
        let target = -1;
        if (over > 0) {
          const held = rows.map((r, i) => ({i, u: unitOf(r)})).filter((x): x is {i: number, u: number} => x.u !== undefined);
          target = (held.find((x) => x.u === over) ?? [...held].sort((a, b) => a.u - b.u)[0])?.i ?? -1;
        } else {
          const room = rows.map((r, i) => ({i, r, u: unitOf(r)})).filter((x) => x.r.value < x.r.max);
          target = (room.find((x) => x.u !== undefined && x.u <= -over) ?? room.find((x) => x.u === undefined) ?? room[0])?.i ?? -1;
        }
        if (target >= 0) {
          await press(target === at ? (over > 0 ? 'KeyQ' : 'KeyE') : target > at ? 'ArrowDown' : 'ArrowUp', pause());
          continue;
        }
      }
      const key = seen.offered.some((o) => o.key === 'KeyX') ? 'KeyX' :
        !dial && steps ? (seen.meter.done > seen.meter.of ? (roll < 0.7 ? 'KeyQ' : 'ArrowDown') : roll < 0.6 ? 'KeyE' : roll < 0.9 ? 'ArrowDown' : 'KeyQ') :
          !dial ? (roll < 0.5 ? 'Enter' : 'ArrowDown') :
            seen.meter.done > seen.meter.of ? (roll < 0.7 ? 'KeyQ' : 'ArrowDown') :
              roll < 0.4 ? 'Period' : roll < 0.6 ? 'KeyE' : roll < 0.85 ? 'ArrowDown' : 'KeyQ';
      await press(key, pause());
      continue;
    }
    // A SPREAD OVER CARDS (the bottle's rule — CI's bottle on `4d74b4f9a0`, game 538: «Разместите 4 флоатера на своих
    // картах», a resolution's effect, «LB/RB Раздача −1 / +1 · A Сохранить», A grey until all are placed): what is left
    // onto the focused card (RT «Остаток сюда»), +1 where it fits, the next card — and A once it is lit.
    if (PILOT >= 3 && /Раздача\s*−1\s*\/\s*\+1/.test(seen.bar) && seen.look === '' && !seen.zoom && !seen.quick) {
      await press(seen.offered.some((o) => o.key === 'Enter') ? 'Enter' : (['Period', 'KeyE', 'ArrowDown'] as const)[standing.presses % 3], pause());
      continue;
    }
    // THE DISTRIBUTION OF RESOURCES (pilot 3): a unit onto the focused row (RB where the layout steps by LB/RB, A where A
    // adds), the next row, another — and the take.
    if (PILOT >= 3 && wf.type === 'resources' && seen.bar.startsWith('Распределение ресурсов') && seen.look === '' && !seen.zoom) {
      const add = seen.offered.some((o) => o.key === 'KeyE') ? 'KeyE' : 'Enter';
      await press(([add, 'ArrowDown', add, 'KeyX'] as const)[standing.presses % 4], pause());
      continue;
    }
    // A CELL PICK WHOSE «A» IS GREY UNDER THE ALL-CELLS LOOK (CI's autopilot on `6ba4e117ff`, game 540 — the ocean of a
    // temperature step): the pilot's own R3 had widened the board to every cell, the cursor stood on one the tile cannot
    // take, and the arrows walked the board cell by cell until the door answered. A player who sees «A» grey there
    // narrows the board back to the legal cells — R3 «Только доступные» — and the cursor lands on the nearest of them.
    if (PILOT >= 3 && wf.type === 'space' && seen.look === '' && !seen.zoom && !seen.quick && seen.greyed.includes('Enter') &&
        seen.offered.some((o) => o.key === 'KeyV') && seen.bar.includes('Только доступные')) {
      log.push('[LEGAL-CELLS]');
      await press('KeyV', pause());
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
      // (…or HELD BY THE CLAIM of a workspace the pilot is not in — the box's count on the weather's snapshot, game
      // 2302: three doors on a Parliament resolution's draw, «external-draw@parliament held claim:parliament», the
      // pilot in «Действия карт», the colonies, the Hydronetwork, while the home's plate said «A Открыть».)
      const owner = await ownerNow();
      const claim = / held claim:([a-z-]+)/.exec(owner)?.[1];
      const heldAway = (seen.frames.length > 0 || seen.quick) && (/ held (aside:|admission:announce-gate)/.test(owner) ||
        (claim !== undefined && !seen.frames.some((f) => f.startsWith(`${claim}:`))));
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
          / held (aside:|admission:announce-gate|claim:)/.test(await ownerNow())) {
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
    // (…and it READS the cards as a player does — the box's count on `b9254000a8`: two doors on «2..2» picks, the Reds'
    // discard of 13 and a deck's keep of 4, the commit grey: a fixed cycle of A / RT / → whose → did not move at a row's
    // end, so the next A took the card back. A card under the cursor already taken — or one the pick refuses — is
    // walked past; an untaken one is taken; the lit commit is pressed.)
    if (PILOT >= 3 && wf.type === 'card' && !standing.menu && standing.presses >= Math.floor(standing.budget / 3) && seen.look === '' && !seen.zoom && !seen.quick &&
        seen.offered.some((o) => o.key === 'Enter') && (seen.offered.some((o) => o.key === 'Period') || seen.greyed.includes('Period'))) {
      const key = seen.offered.some((o) => o.key === 'Period') ? 'Period' :
        !seen.focusTaken ? 'Enter' : (['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const)[standing.presses % 4];
      await press(key, pause());
      continue;
    }
    // THE TAG FILTER OVER A PICK OF CARDS (CI's autopilot on `4d74b4f9a0`, game 582 — the door on the corporation's
    // «discard 3 of 5»): the pilot's ▲ reached the hand's chip row and its A applied a tag, the album showed only cards
    // already taken, and the pick's → → ↓ ← walk never found the third. A player who is choosing among ALL their cards
    // puts «Все» back: on the chip row of a question of cards, ◄ to «Все» and A.
    if (PILOT >= 3 && wf.type === 'card' && seen.look === '' && !seen.zoom && !seen.quick && seen.bar.includes('Применить фильтр')) {
      const onAll = await page.evaluate(() => document.querySelector('.con-hand__filter--focused')?.getAttribute('data-hand-filter') === 'all');
      await press(onAll ? 'Enter' : 'ArrowLeft', pause());
      continue;
    }
    // A PRELUDE PLAYED WITHOUT ITS EFFECT (CI's autopilot on `4d74b4f9a0`, game 582 — the door on «Select prelude card to
    // play»): A on a prelude whose effect cannot happen asks once more — «A Разыграть без эффекта · B Вернуться к выбору».
    // The single pick's A / → cycle walked off that confirm every time. A player looks at the other card once or twice,
    // then plays one without its effect: the confirm's A, after the first look at it.
    if (PILOT >= 3 && wf.type === 'card' && seen.look === '' && !seen.zoom && !seen.quick && seen.offered.some((o) => o.key === 'Enter') &&
        seen.bar.includes('Разыграть без эффекта')) {
      standing.noEffect = (standing.noEffect ?? 0) + 1;
      await press(standing.noEffect >= 2 || g() < 0.5 ? 'Enter' : 'ArrowRight', pause());
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
    // …AND A REMATCH THE TABLE DECLINES (a table of two humans or more — stage 6, `surface:rematch-layer`; at a table of
    // one human an offer creates the new game at once, nobody can say no): once the results' actions stand, the pilot
    // walks to «Предложить реванш» and offers it; another human says no at its own console (over the API — to this page
    // exactly what another player's console does). The action comes back and names who declined; the finale goes on.
    const rematchOf = async (seat: string): Promise<string> =>
      ((await (await request.get(`/api/game/rematch?id=${seat}`)).json()) as {status?: string}).status ?? '';
    let rematchOwed = rivals.length > 0;
    for (let i = 0; i < (rematchOwed ? 90 : 40) && !page.isClosed(); i++) {
      if (rematchOwed && await page.locator('.con-eg__action[data-eg-action="rematch-offer"], .con-eg__action[data-eg-action="rematch-cancel"]').count() > 0) {
        if (await rematchOf(viewer) === 'offered') {
          const declined = await request.post(`/api/game/rematch?id=${rivals[0]}&action=decline`);
          log.push(`[REMATCH-DECLINED${declined.ok() ? '' : ` REFUSED ${declined.status()}`}]`);
          rematchOwed = false;
          continue;
        }
        const focused = await page.evaluate(() => document.querySelector('.con-eg__action--focused')?.getAttribute('data-eg-action') ?? '');
        await press(focused === 'rematch-offer' ? 'Enter' : 'ArrowDown', pause());
        continue;
      }
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
      // (A SCENARIO's fixture instead of a plain table — see `SCENARIO`; its seats are all human, the first one the viewer.)
      const scenario = scenarioOf(n);
      const scenarioSeats = scenario === undefined ? undefined : await loadFixtureSeats(request, scenario);
      if (scenario !== undefined) {
        test.info().annotations.push({type: 'autopilot-scenario', description: scenario});
        table.word = `scenario ${scenario}`;
        table.deal.splice(0);
      }
      // (A CAMPAIGN's mission instead of a plain table — see `CAMPAIGN`.)
      const mission = scenario === undefined && campaignGame(n) ? await campaignMission(request, n, table) : undefined;
      if (mission !== undefined) {
        test.info().annotations.push({type: 'autopilot-campaign', description: mission.word});
        table.word = `${mission.word} · ${table.word}`;
        table.deal.splice(0);
      }
      let created = mission !== undefined || scenarioSeats !== undefined ? undefined : await request.post('/api/creategame', {data: table.config});
      // (A deal the creator refuses — a card its rules keep off a custom deck — is the harness's, never the game's: the
      // table is dealt plainly and the refusal named.)
      if (created !== undefined && !created.ok() && table.deal.length > 0) {
        const why = (await created.text()).slice(0, 200);
        test.info().annotations.push({type: 'autopilot-deal-refused', description: `${created.status()} ${why} — deal ${table.deal.join(', ')}`});
        table.deal.splice(0);
        created = await request.post('/api/creategame', {data: {...table.config, customProjectCards: [], customCorporationsList: [], customPreludes: []}});
      }
      let viewer: string;
      let rivals: Array<string>;
      if (scenarioSeats !== undefined) {
        viewer = scenarioSeats[0];
        rivals = scenarioSeats.slice(1);
      } else if (created === undefined) {
        viewer = (mission as {viewer: string}).viewer;
        rivals = (mission as {rivals: Array<string>}).rivals;
      } else {
        expect(created.ok(), `create-game refused the table (${table.word}): ${created.status()}`).toBeTruthy();
        const {players} = await created.json() as {players: Array<{id: string, name: string}>};
        viewer = (players.find((p) => !/marsbot/i.test(p.name)) ?? players[0]).id;
        rivals = players.filter((p) => p.id !== viewer && !/marsbot/i.test(p.name)).map((p) => p.id);
      }
      // THE OPENING, over the API (see the header): the corporation, the preludes, the first action — to the first turn.
      // (Every human seat at once: the opening is simultaneous, and a seat seeded alone waits for the other one.)
      // (THE DEAL — see `DEAL`: what the rotation put on the decks' tops and the first seat was dealt is TAKEN — the
      // corporation, the preludes, the projects; a card the table's rules kept out of the deal is simply not there.)
      const offered = await fetchPlayerModel(request, viewer).then((model) => new Set(
        ((model.waitingFor as {options?: Array<{cards?: Array<{name: string}>}>} | undefined)?.options ?? []).flatMap((o) => (o.cards ?? []).map((c) => c.name))));
      // (…a SCENARIO's own list is what it is for — the cards its pilot steers to, already on the table.)
      const dealt = scenario !== undefined ? [...SCENARIO_TARGETS[scenario]] : table.deal.filter((name) => offered.has(name));
      const is = (list: ReadonlyArray<ScopeCard>) => (name: string) => list.some((c) => c.name === name);
      // (…a campaign's mission opens through the screen always: its tenders stand in the start scene.)
      // (…and a SCENARIO's opening is its own — a corporation's first action left owed in the fixture is played through
      // the start's screen, never seeded over the API.)
      // (…one dealt game in eight — `n % 8 === 2`: the scenarios take 1 · 3 · 7 and the campaign 5 (`SCENARIO_SLOTS`) —
      // and every game the LEDGER's prelude is dealt to: its flow is the start's own.)
      const ledgerPrelude = LEDGER_CARDS.preludes.some((card) => dealt.includes(card));
      const uiOpening = OPENING === 'ui' || (OPENING === 'auto' && n % 8 === 2) || ledgerPrelude || mission !== undefined || scenario !== undefined;
      await Promise.all([
        ...(uiOpening ? [] : [seedGameOverApi(request, viewer, {
          buy: 4,
          cards: dealt.filter(is(SCOPE_CARDS.projects)),
          corporation: dealt.find(is(SCOPE_CARDS.corporations)),
          preludes: dealt.filter(is(SCOPE_CARDS.preludes)),
        })]),
        ...rivals.map((rival) => seedRivalOpening(request, rival))]);
      const log: Array<string> = [];
      if (uiOpening) {
        test.info().annotations.push({type: 'autopilot-opening', description: 'through the screen'});
        log.push('[OPENING through the screen]');
      }
      if (dealt.length > 0) {
        log.push(`[DEAL ${dealt.join(' · ')}]`);
      }
      const consoleTail: Array<string> = [];
      const ears: SoakEars = {longFrames: 0, warnings: 0, lastWarnings: []};
      const book: LogBook = new Map();
      const where = {stood: ''};
      const t0 = Date.now();
      // THE WEATHER of this game (see `WEATHER`): a storm in one game of three by default, seeded by the game's number.
      const storm = WEATHER === 'storm' || (WEATHER === 'auto' && n % 3 === 0);
      // THE SLOW MACHINE of this game (see `SLOW`) — and the frames it makes long: on a page run at a third of the speed a
      // long frame is the machine's by construction, booked apart (`slowFrames`), never a line of the game.
      const slow = slowRateOf(n);
      let slowFrames = 0;
      const weather = {next: 12 + (n % 7), submits: 0, faults: 0, kind: n % WEATHER_KINDS.length, said: 0,
        explains: [] as Array<{until: number, says: ReadonlyArray<RegExp>}>};
      const weatherSaid = (text: string): boolean => {
        const now = Date.now();
        weather.explains = weather.explains.filter((e) => e.until > now);
        if (weather.explains.some((e) => e.says.some((re) => re.test(text)))) {
          weather.said++;
          return true;
        }
        return false;
      };
      if (storm) {
        test.info().annotations.push({type: 'autopilot-weather', description: 'storm'});
        await page.route(/\/player\/input(-batch)?\?/, async (route) => {
          if (route.request().method() !== 'POST' || ++weather.submits < weather.next) {
            await route.continue();
            return;
          }
          const kind = WEATHER_KINDS[weather.kind++ % WEATHER_KINDS.length];
          weather.next = weather.submits + 14 + ((weather.submits * 7 + n) % 19);
          weather.faults++;
          log.push(`[WEATHER ${kind} #${weather.faults}]`);
          // (…what the page says of it, for the next twelve seconds — a lost answer's next press is refused, too.)
          weather.explains.push({until: Date.now() + 12_000, says: WEATHER_SAYS[kind]});
          if (kind === 'lost') {
            await route.abort('failed');
          } else if (kind === 'busy') {
            await route.fulfill({status: 503, contentType: 'text/plain', body: 'Service Unavailable'});
          } else if (kind === 'lost-answer') {
            await route.fetch().catch(() => undefined);
            await route.abort('failed');
          } else {
            const body = route.request().postDataJSON() as {promptId?: unknown} | null;
            if (body !== null && typeof body === 'object' && typeof body.promptId === 'number') {
              await route.continue({postData: JSON.stringify({...body, promptId: body.promptId - 1})});
            } else {
              await route.abort('failed');
              weather.explains.push({until: Date.now() + 12_000, says: WEATHER_SAYS.lost});
            }
          }
        });
      }
      const said = (type: string, text: string): void => {
        if (weatherSaid(text)) {
          return;
        }
        if (slow > 1 && text.startsWith('[long-frame]')) {
          slowFrames++;
          return;
        }
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
      // WHAT THE SCREEN SENT (the coverage's input-type axis, whole): every response a submit of the page carries — a
      // composer's batch included, whose sub-answers never stand as a question of their own — summed by its type.
      const sent: Record<string, number> = {};
      const sentTypes = (response: unknown): void => {
        if (response === null || typeof response !== 'object') {
          return;
        }
        const r = response as {type?: unknown, response?: unknown, responses?: unknown};
        if (typeof r.type === 'string') {
          sent[r.type] = (sent[r.type] ?? 0) + 1;
        }
        sentTypes(r.response);
        if (Array.isArray(r.responses)) {
          r.responses.forEach(sentTypes);
        }
      };
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input(-batch)?\?/.test(req.url())) {
          try {
            sentTypes(req.postDataJSON());
          } catch {
            // (A body that is not JSON is no answer of the screen's.)
          }
        }
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          said('http', `${response.status()} ${response.request().method()} ${response.url().replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '')}`);
          // (…and a refused SUBMIT says WHY in the walk — the server's own word: CI's game 270, «400 POST
          // /player/input-batch» at a colony's trade, and nothing of which rule refused it.)
          if (response.request().method() === 'POST' && /\/player\/input/.test(response.url())) {
            void response.text().then((body) => log.push(`[REFUSED ${response.status()} ${body.replace(/\s+/g, ' ').slice(0, 200)}]`), () => undefined);
          }
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
      // (The Deck asleep — `pageAway`'s gate stands before the page loads: GSAP takes the frame clock at its start.)
      if (storm) {
        await installPageAway(page);
      }
      if (slow > 1) {
        test.info().annotations.push({type: 'autopilot-slow', description: `CPU ×${slow}`});
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: slow});
        log.push(`[SLOW ×${slow}]`);
      }
      await openConsole(page, viewer);
      let played: Played | undefined;
      try {
        played = await playGame(page, request, viewer, seed, log, ears, where, rivals,
          storm ? {reloadAt: 120 + ((n * 97) % 900), reloaded: false, awayAt: 90 + ((n * 43) % 800), awayDone: false,
            awayMs: 6_000 + (n % 12) * 1_000, awayHidden: n % 2 === 0,
            blipAt: 60 + ((n * 61) % 700), blipped: false, blip: async () => {
            // (The network gone — every request of the page, the socket's too — for six seconds, then back. What the
            // page says of it in that time and the twelve seconds after is the weather's.)
              weather.explains.push({until: Date.now() + 20_000, says: [/^\[net\] /, /^\[transport\] the poll/]});
              const cdp = await page.context().newCDPSession(page);
              await cdp.send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
              await cinematicBeat(page, 6_000, 'the weather\'s blip — the network is gone for six seconds, by design');
              await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
              await cdp.detach().catch(() => undefined);
            }} : undefined, dealt);
        // THE LAST WORD: past the arbiter's grace and the loop's twenty looks — the screen the game left is judged whole.
        await cinematicBeat(page, 25_000, 'the last word — a quiet spell past the liveness grace, so the screen the game left is judged');
      } finally {
        // THE CARDS THE PILOT PLAYED through the console (the viewer's tableau at the game's end — a corporation, a
        // prelude, every project), and the weather the game met: two axes of the coverage the report sums over games.
        // (…and every card the viewer's plays LOGGED that left it — Law Suit lies in the sued player's tableau, Astra
        // Mechanica takes events back to the hand: read off the tableau alone, the scenario of the cities played Law Suit
        // and the axis never counted it.)
        const tableau = await fetchPlayerModel(request, viewer).then(async (model) => {
          const seen = model as unknown as {thisPlayer?: {color?: string, tableau?: Array<{name: string}>}, game?: {generation?: number}};
          const names = new Set((seen.thisPlayer?.tableau ?? []).map((c) => c.name));
          for (const name of await loggedPlays(request, viewer, seen.thisPlayer?.color, seen.game?.generation ?? 0)) {
            names.add(name);
          }
          return [...names];
        }).catch(() => [] as Array<string>);
        causeHarvest.note({
          monkey: {seed, fixture: `game-${n}`, mode: 'autopilot', landing: 'boot', duo: table.duo, reload: false, hidden: false, presses: played?.presses ?? log.filter((l) => !l.startsWith('[')).length,
            perturb: {netMs: 0, cpu: slow > 1 ? slow : Number(process.env.TM_E2E_CPU_THROTTLE ?? 0), motion: process.env.TM_E2E_MOTION ?? ''}},
          autopilot: {
            ...played, table: table.word, pilot: PILOT, cards: tableau, slow, slowFrames, sent,
            weather: storm ? {faults: weather.faults, submits: weather.submits, said: weather.said} : undefined,
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
