/*
 * THE AUTOPILOT IN THE BOTTLE — WHOLE GAMES, FIRST PRESS TO FINAL SCORING (FREEZE ZERO, stage 6).
 *
 * `autopilot.ts` plays one table to its end through the real console; this file runs a range of seeds, each a table
 * the engine fuzz draws (`fuzzConfig(seed)` — every in-scope expansion, MarsBot in three games of four, one to three
 * humans, every board), and files each game as the monkey files a walk: `cause-classes/<game>.json` — the product's
 * own journal by cause class, the one-owner measure, the kernel's coverage — plus the pilot's own numbers (how the
 * game ended, in which generation, which questions the screen answered and which had to be answered for it). So
 * `node scripts/monkey-report.mjs <out dir>` sums a pass of whole games exactly as it sums a pass of walks, and its
 * gate holds the same laws.
 *
 * A class is DATA here, never a red test (the report and its gate judge) — with ONE exception that is the stage's own
 * number: a REBUILD. A page that had to be rebuilt in the middle of a game is the last line doing a flow's work.
 *
 * OPT-IN (a game is a minute or two of the laptop): `TM_BOTTLE_AUTOPILOT=1 npm run test:client:one -- tests/client/bottle/autopilot.bottle.ts`
 *   TM_BOTTLE_AUTOPILOT_SEEDS (`<from>-<to>` or a list `3,17,40`; default `1-4`) · TM_BOTTLE_AUTOPILOT_NAME (the pass's
 *   name in the seeds: `<name>:<n>`, default `ap0`) · TM_BOTTLE_AUTOPILOT_PRESSES (the cap, default 4000) ·
 *   TM_BOTTLE_AUTOPILOT_LAYOUT (`synthetic` — measured ends are non-empty; default `none`: jsdom's 0×0, the border the gate is measured on) ·
 *   TM_BOTTLE_AUTOPILOT_OUT (default `.e2e-remote/bottle-autopilot`).
 */
import {bootBottle, ConsoleBottle, disposeLiveBottle} from './consoleBottle';
import {bottleServer, nodeProcess, nodeRequire} from './bottleNode';
import {monkeyRng} from './monkeyWalk';
import {autopilotGame, AutopilotResult} from './autopilot';
import type {BottleTable} from './server/bottleServerHost';
import {dealFor, modulesOfOptions, SCENARIO_TARGETS, scenarioFor, DealSource} from '../../testing/autopilotDeal';

const env = nodeProcess().env as Record<string, string | undefined>;
const ENABLED = env.TM_BOTTLE_AUTOPILOT === '1';
const NAME = env.TM_BOTTLE_AUTOPILOT_NAME ?? 'ap0';
const PRESSES = Number(env.TM_BOTTLE_AUTOPILOT_PRESSES ?? 4_000);
const OUT = env.TM_BOTTLE_AUTOPILOT_OUT ?? '.e2e-remote/bottle-autopilot';
const DEBUG = env.TM_BOTTLE_AUTOPILOT_DEBUG === '1';
const LAYOUT: 'none' | 'synthetic' = env.TM_BOTTLE_AUTOPILOT_LAYOUT === 'synthetic' ? 'synthetic' : 'none';
/** The untouched spell after a game: past the arbiter's grace and the loop's twenty looks — the page's last word. */
const IDLE_MS = 25_000;

function seedsOf(spec: string): Array<number> {
  const range = /^(\d+)-(\d+)$/.exec(spec);
  if (range !== null) {
    const from = Number(range[1]);
    return Array.from({length: Math.max(0, Number(range[2]) - from + 1)}, (_, i) => from + i);
  }
  return spec.split(',').map((part) => Number(part.trim())).filter((n) => Number.isFinite(n));
}
const SEEDS = seedsOf(env.TM_BOTTLE_AUTOPILOT_SEEDS ?? '1-4');
/** THE DEAL (`tests/testing/autopilotDeal.ts`): `rotate` (the default) — the scope's cards to the opening hand in turn. */
const DEAL_MODE = env.TM_BOTTLE_AUTOPILOT_DEAL ?? 'rotate';
const DEAL = DEAL_MODE === 'rotate' || DEAL_MODE === 'missing';
/** `missing` — the cards no whole game has played yet first (`UNPLAYED_CARDS`, the cards axis' worklist). */
const DEAL_SOURCE: DealSource = DEAL_MODE === 'missing' ? 'unplayed' : 'scope';
/** THE SCENARIO TABLES (`autopilotDeal.scenarioFor` — the browser pilot's own list): `auto` · `off` · `always`. */
const SCENARIO = env.TM_BOTTLE_AUTOPILOT_SCENARIO ?? 'auto';

type Filed = {cls: string, shape: string, tier: string, family: string, page: number, count: number, lines: number, atMs: number, title: string, dims: Record<string, string>};
const filed = (cls: string, tier: string, count: number, text: string): Filed => ({
  cls, shape: cls.split('/').slice(0, 2).join('/'), tier, family: cls.split('/')[0], page: 0, count, lines: count, atMs: 0,
  title: text.split('\n')[0].slice(0, 300), dims: {},
});

describe('THE AUTOPILOT IN THE BOTTLE — whole games through the real console, on the manual clock', function() {
  // A game boots a whole application and plays it out; a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(7_200_000);

  if (!ENABLED) {
    it.skip('opt-in: TM_BOTTLE_AUTOPILOT=1 (a minute or two of the laptop per game)', () => undefined);
    return;
  }

  const fs = nodeRequire()('fs') as typeof import('fs');
  const path = nodeRequire()('path') as typeof import('path');
  const outDir = path.resolve(nodeProcess().cwd(), OUT, 'cause-classes');
  fs.mkdirSync(outDir, {recursive: true});

  let bottle: ConsoleBottle | undefined;
  let restoreRandom: (() => void) | undefined;
  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
    await disposeLiveBottle();
    restoreRandom?.();
    restoreRandom = undefined;
    bottleServer().reset();
  });

  for (const n of SEEDS) {
    it(`autopilot · game ${n}`, async () => {
      const seed = `${NAME}:${n}`;
      const records: Array<Filed> = [];
      let status = 'passed';
      let played: AutopilotResult | undefined;
      let table: BottleTable | undefined;
      /** What the table is, in the game's line: its seats and board — or its scenario. */
      let tableWord = '';
      let why: Array<string> = [];
      let rebuilds = 0;
      let coverage: ReturnType<ConsoleBottle['coverage']>;
      let owner: ReturnType<ConsoleBottle['servingOwner']>;
      try {
        // THE GAME'S WHOLE WORLD IS ITS SEED (as a walk's): every roll that is not the engine's own seeded one.
        restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
        // (A SCENARIO's fixture instead of a table of its own — its seats all human, the first one the viewer.)
        const scenario = scenarioFor(n, SCENARIO);
        // (THE CARDS THE GAME IS FOR — a scenario's targets, or the deal's projects: the pilot steers to them.)
        let targets: ReadonlyArray<string> = [];
        let startTargets: ReadonlyArray<string> = [];
        if (scenario !== undefined) {
          table = await bottleServer().bootFixture(scenario);
          tableWord = `scenario ${scenario}`;
          targets = SCENARIO_TARGETS[scenario];
        } else {
          const pilotTable = bottleServer().bootPilotTable(n, `-${NAME}-${n}`, DEAL, DEAL_SOURCE);
          if (DEAL) {
            const options = pilotTable.config.options;
            const dealt = dealFor(n, modulesOfOptions(options), options.preludeExtension === true, DEAL_SOURCE);
            targets = dealt.projects;
            startTargets = [...dealt.corporations, ...dealt.preludes, ...dealt.projects];
          }
          table = pilotTable;
          tableWord = `${pilotTable.config.humans}h${pilotTable.config.marsBot ? '+bot' : ''} ${String(pilotTable.config.options.boardName)}`;
        }
        bottle = await bootBottle(table, {query: 'coverage=1', layout: LAYOUT});
        await bottle.advance(3_000);
        const page = bottle;
        const viewer = table.seats[0].id;
        let dumps = 0;
        played = await autopilotGame(bottle, table.seats, seed, {
          maxPresses: PRESSES,
          targets,
          startTargets,
          // THE SOAK: what a page that leaks would grow by, counted at the board home once a generation.
          sample: () => {
            (globalThis as unknown as {gc?: () => void}).gc?.();
            const flow = page.flow();
            if (DEBUG) {
              // WHAT STANDS, by kind: the scopes of the tree and the DOM's classes — two samples apart say what grew.
              const count = (names: Array<string>): string => Object.entries(names.reduce((acc: Record<string, number>, name) => ({...acc, [name]: (acc[name] ?? 0) + 1}), {}))
                .filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([name, n]) => `${name}×${n}`).join(' ');
              type Node = {className: unknown, tagName: string, parentElement: Node | null};
              const els = [...(globalThis as unknown as {window: {document: {querySelectorAll(q: string): Iterable<Node>}}}).window.document.querySelectorAll('*')];
              const named = (el: Node): string => {
                if (typeof el.className === 'string') {
                  return el.className.split(' ')[0];
                }
                // (An SVG node: its tag, and the first HTML ancestor that has a class — whose picture it is.)
                let host: Node | null = el.parentElement;
                while (host !== null && typeof host.className !== 'string') {
                  host = host.parentElement;
                }
                return `${el.tagName.toLowerCase()}<${host === null ? '?' : String(host.className).split(' ')[0]}`;
              };
              console.log(`      ── SOAK gen ${bottleServer().seatTruth(viewer).generation} — scopes: ${count(flow.tree.map((line) => line.trim().split('#')[0]))} · nodes: ${count(els.map(named))}`);
            }
            return {
              nodes: (globalThis as unknown as {window: {document: {querySelectorAll(q: string): {length: number}}}}).window.document.querySelectorAll('*').length,
              scopes: flow.tree.length,
              waits: flow.waits,
              timers: page.clock.pending(),
              heapMb: Math.round((nodeProcess() as unknown as {memoryUsage(): {heapUsed: number}}).memoryUsage().heapUsed / 1e6),
            };
          },
          trace: !DEBUG ? undefined : () => `${page.frames().join('>') || '-'}|${page.pageModules.consoleDraftFlow.draftWorkspaceState.completion}|g${bottleServer().seatTruth(viewer).generation}|${bottleServer().seatTruth(viewer).waitingFor ?? '-'}|D${page.liveness().defects.reduce((sum, d) => sum + d.count, 0)}|${page.bar().replace(/\s+/g, '').slice(0, 60)}`,
          // THE READING AID (`TM_BOTTLE_AUTOPILOT_DEBUG=1`): where the door had to answer, what stood — the server's
          // truth, the page's view, the stack, the arbiter's word, the kernel's tree, the screen's own words.
          onDoor: !DEBUG ? undefined : (what, lastPresses) => {
            if (dumps++ >= 4) {
              return;
            }
            const truth = bottleServer().seatTruth(viewer);
            const doc = (globalThis as unknown as {window: {document: {querySelector(q: string): {textContent: string | null} | null}}}).window.document;
            const text = (selector: string): string => (doc.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
            console.log([
              `      ── THE DOOR · ${what} ──`,
              `      server: asks ${truth.waitingFor ?? 'nothing'} #${truth.promptId ?? '-'} · phase ${truth.phase} · generation ${truth.generation} · age ${truth.gameAge}`,
              `      page: shows ${page.view()?.waitingFor?.type ?? 'nothing'} #${page.view()?.waitingFor?.promptId ?? '-'} · frames ${page.frames().join(' > ') || 'none'} · bar «${page.bar().replace(/\s+/g, ' ').slice(0, 200)}»`,
              `      liveness: ${page.liveness().why.join(' | ') || 'ok'}`,
              `      readiness: frames ${page.ready().wsFrames.join(' > ')} · yielded ${page.ready().wsYielded} · holds ${page.ready().holds.join(',') || 'none'} · absorbers ${page.ready().absorbers.join(',') || 'none'}`,
              `      tree: ${page.flow().tree.slice(0, 14).join(' ¦ ')}`,
              `      draft: ${JSON.stringify({...page.pageModules.consoleDraftFlow.draftWorkspaceState, picks: undefined, meta: undefined})} · view phase ${page.view()?.game.phase} · needsToResearch ${String(page.view()?.thisPlayer.needsToResearch)} · stages ${[...((globalThis as unknown as {window: {document: {querySelectorAll(q: string): Iterable<{className: string, style: {display: string}}>}}}).window.document.querySelectorAll('.con-draftws__stage'))].map((el) => `${el.className.replace('con-draftws__stage ', '').replace('con-draftws__stage--', '')}${el.style.display === 'none' ? '(hidden)' : ''}`).join(',')}`,
              `      reveal: ${(() => {
                const el = (globalThis as unknown as {window: {document: {querySelector(q: string): {className: string, getAttribute(n: string): string | null} | null}}}).window.document.querySelector('.con-reveal');
                const o = page.pageModules.consoleWorkspaceOutcome.workspaceOutcomeState;
                return `${el === null ? 'none' : `take=${el.getAttribute('data-take')} table=${el.getAttribute('data-settlement-table')}/${el.getAttribute('data-settlement-turn')} cursor=${el.getAttribute('data-cursor-pending')} class=${el.className}`} · claim ${JSON.stringify({host: o.host, source: o.sourceCard, stage: o.stage, arrivalDone: o.arrivalDone, arrivalFlown: o.arrivalFlown, beatDone: o.beatDone})}`;
              })()}`,
              `      workspace: «${text('.con-draftws') || text('.con-hand') || text('.con-task') || text('.con-root')}»`,
              `      start: ${JSON.stringify((globalThis as unknown as {window: {__conStartDiag?: () => unknown}}).window.__conStartDiag?.() ?? 'no scene').slice(0, 1400)}`,
              `      the last presses: ${lastPresses.join('  ')}`,
              `      start state: ${(() => {
                const s = page.pageModules.consoleStartState.consoleStartState as unknown as Record<string, unknown>;
                const w = page.pageModules.consoleWorkspaceStack;
                const plain = Object.fromEntries(Object.entries(s).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'object' && !(v instanceof Set) && JSON.stringify(v).length < 260)));
                return `${JSON.stringify(plain).slice(0, 1800)} · frame known ${w.workspaceFrameKnown('start')} parked ${w.workspaceFrameParked('start')} index ${w.workspaceFrameIndex('start')} nested ${w.workspaceFrameHasNested('start')}`;
              })()}`,
            ].join('\n'));
          },
        });
        // THE READING AID, the probe (`TM_BOTTLE_AUTOPILOT_PROBE=<selector>;<selector>…`, with the cap of presses as the
        // moment): where the game stands when the walk stops — each selector's elements, their chain of ancestors.
        if (DEBUG && env.TM_BOTTLE_AUTOPILOT_PROBE !== undefined) {
          type El = {className: unknown, isConnected: boolean, parentElement: El | null, getAttribute(n: string): string | null, style: {display: string}, tagName: string, children: {length: number}};
          const doc = (globalThis as unknown as {window: {document: {querySelectorAll(q: string): Iterable<El>}}}).window.document;
          const o = page.pageModules.consoleWorkspaceOutcome;
          console.log(`      ── THE PROBE at press ${played.presses} — frames ${page.frames().join(' > ')} · ready ${page.ready().wsFrames.join(' > ')} · bar «${page.bar().replace(/\s+/g, ' ').slice(0, 120)}» · ` +
            `claim ${JSON.stringify({host: o.workspaceOutcomeState.host, source: o.workspaceOutcomeState.sourceCard, stage: o.workspaceOutcomeState.stage, slot: o.workspaceOutcomeState.embedSlot, zone: o.workspaceOutcomeZone()})} · holds ${page.ready().holds.join(',')}`);
          for (const selector of env.TM_BOTTLE_AUTOPILOT_PROBE.split(';')) {
            const found = [...doc.querySelectorAll(selector)];
            console.log(`      ${selector}: ${found.length}`);
            for (const el of found.slice(0, 4)) {
              const chain: Array<string> = [];
              for (let n: El | null = el; n !== null && chain.length < 9; n = n.parentElement) {
                chain.push(`${n.tagName.toLowerCase()}.${String(n.className).split(' ').slice(0, 3).join('.')}${n.style.display === 'none' ? '[hidden]' : ''}${n.getAttribute('data-embed-slot') !== null ? `[slot=${n.getAttribute('data-embed-slot')}]` : ''}`);
              }
              console.log(`        connected ${el.isConnected} · children ${el.children.length} · ${chain.join(' < ')}`);
            }
          }
          console.log(`      tree: ${page.flow().tree.slice(0, 40).join(' ¦ ').slice(0, 3000)}`);
        }
        // THE READING AID, second half: every warn / error line of the page in order, with the dozen before each
        // line a class was named by — what led to it.
        if (DEBUG) {
          const all = bottle.lines();
          const named = /\[(liveness|wait-graph|workspace-outcome|workspace-stall|console-leak-detector|console-foreground-watchdog|screen-shadow|mandatory-gate|screen-handoff|notifications|animation-hold|start-stranded|start-shadow|invariant)\]/;
          let from = 0;
          all.forEach((line, at) => {
            if (named.test(line) && at >= from) {
              console.log([`      ── LINES ${Math.max(from, at - 12)}…${at} ──`,
                ...all.slice(Math.max(from, at - 12), at + 1).map((l) => `        ${l.replace(/\s+/g, ' ').slice(0, 700)}`)].join('\n'));
              from = at + 1;
            }
          });
        }
        // THE LAST WORD: whatever the game left on screen — the finale's last screen, or where a capped game stood.
        await bottle.advance(IDLE_MS);
        const live = bottle.liveness();
        why = live.why;
        rebuilds = bottle.rebuildsAsked();
        coverage = bottle.coverage();
        owner = bottle.servingOwner();
        for (const defect of live.defects) {
          records.push(filed(defect.cls, 'defect', defect.count, defect.text));
        }
        for (const blind of live.blind) {
          records.push(filed(blind.cls, 'info', blind.count, `(the bottle is blind here) ${blind.text}`));
        }
        // THE PILOT's OWN FINDINGS, as classes of the same report: a game that did not end, a page rebuilt under it.
        if (played.end === 'stuck') {
          records.push(filed(`autopilot/stuck/${played.phase}`, 'defect', 1, `nobody was asked and nothing moved for minutes — generation ${played.generation}, phase ${played.phase}`));
        }
        if (rebuilds > 0) {
          records.push(filed('autopilot/rebuilt', 'defect', rebuilds, `the page was rebuilt ${rebuilds}× inside one game (generation ${played.generation})`));
        }
      } catch (error) {
        status = 'harness';
        records.push(filed('bottle/harness-error', 'info', 1, error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)));
      }
      const title = `autopilot · game ${n}`;
      fs.writeFileSync(path.join(outDir, `bottle-autopilot--game-${n}-r0.json`), JSON.stringify({
        file: 'autopilot.bottle.ts', title, retry: 0, status, records,
        ...(coverage !== undefined ? {coverage} : {}),
        ...(owner !== undefined ? {owner} : {}),
        monkey: {seed, fixture: `game-${n}`, mode: 'autopilot', layout: LAYOUT, landing: 'boot', duo: false, reload: false, hidden: false, faults: [], presses: played?.presses ?? 0, perturb: {netMs: 0, cpu: 0, motion: ''}, bottle: true, why},
        autopilot: played === undefined ? undefined : {
          end: played.end, generation: played.generation, phase: played.phase, presses: played.presses, byUi: played.byUi, byApi: played.byApi,
          passes: played.passes, seatMoves: played.seatMoves, tookMs: played.tookMs, rebuilds, table: table?.config, doors: played.doors, soak: played.soak,
          // (The cards axis — the viewer's tableau at the game's end: what the pilot played through the console.)
          cards: table === undefined ? [] : bottleServer().seatTableau(table.seats[0].id),
        },
        walk: played?.log.join(' ') ?? '',
      }, null, 1));
      const defects = records.filter((record) => record.tier === 'defect');
      const sum = (row: Record<string, number>): string => Object.entries(row).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
      console.log(status !== 'passed' ? `      · game ${n}: HARNESS — ${records[records.length - 1].title.slice(0, 200)}` :
        `      · game ${n} [${tableWord}]: ${played?.end} in generation ${played?.generation} (${played?.phase}) · ` +
        `${played?.presses} presses, ${Math.round((played?.tookMs ?? 0) / 60_000)} min of play · by the screen: ${sum(played?.byUi ?? {})} · by the door: ${sum(played?.byApi ?? {})} · ` +
        `passes ${played?.passes.ui} by the wheel / ${played?.passes.api} by the door${defects.length > 0 ? ` · DEFECTS: ${defects.map((d) => d.cls).join(' | ')}` : ''}`);
    });
  }
});
