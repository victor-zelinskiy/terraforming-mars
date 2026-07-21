import {test, expect, Page} from '@playwright/test';

// Reproduction for the EstablishedMethods console std-project stranding bug.
// EstablishedMethods (prelude) makes the player play TWO standard projects in a
// row via SelectStandardProjectToPlay ('Select your first/second standard
// project'). In console mode the dedicated `.con-stdp` screen must serve BOTH
// prompts — never the stranded guard (`.con-stranded`).

const EM = 'Established Methods';

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'EMTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false,
    fastModeOption: false, showOtherPlayersVP: false, testMode: true,
    aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false,
    modularMA: false, draftVariant: false, initialDraft: false,
    preludeDraftVariant: false, ceosDraftVariant: false, startingCorporations: 2,
    shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [],
    customColoniesList: [], customPreludes: [EM],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function key(page: Page, code: string, settleMs = 600): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function slots(page: Page): Promise<Array<string>> {
  return page.$$eval('.con-cards__slot', (els) => els.map((e) => e.getAttribute('data-zoom-slot') ?? ''));
}
async function focusIdx(page: Page): Promise<number> {
  return page.$$eval('.con-cards__slot', (els) => els.findIndex((e) => e.classList.contains('con-cards__slot--focused')));
}
async function isPicked(page: Page, name: string): Promise<boolean> {
  return page.evaluate((n) => {
    const el = document.querySelector(`[data-zoom-slot="${n}"]`);
    return el?.classList.contains('con-cards__slot--picked') ?? false;
  }, name);
}
async function pickCard(page: Page, name: string): Promise<void> {
  const list = await slots(page);
  const target = list.indexOf(name);
  if (target === -1) {
    return;
  }
  for (let g = 0; g < 12; g++) {
    const f = await focusIdx(page);
    if (f === target) {
      break;
    }
    await key(page, f < target ? 'ArrowRight' : 'ArrowLeft', 260);
  }
  if (!(await isPicked(page, name))) {
    await key(page, 'Enter', 500);
  }
}

type Snap = {start: boolean, stdp: boolean, stranded: boolean, activeStep: number, steps: number,
  hasCount: boolean, ready: boolean, title: string, hasEM: boolean};
async function snap(page: Page): Promise<Snap> {
  return page.evaluate((em) => {
    const steps = [...document.querySelectorAll('.con-start__step')];
    const activeStep = steps.findIndex((s) => s.classList.contains('con-start__step--active'));
    const count = document.querySelector('.con-start__count');
    const stdpTitle = document.querySelector('.con-stdp__title')?.textContent?.trim() ?? '';
    const strandedTitle = document.querySelector('.con-stranded__title')?.textContent?.trim() ?? '';
    const hasEM = document.querySelector(`.con-cards__slot[data-zoom-slot="${em}"]`) !== null;
    return {
      start: document.querySelector('.con-start__frame') !== null,
      stdp: document.querySelector('.con-stdp') !== null,
      stranded: document.querySelector('.con-stranded') !== null,
      activeStep, steps: steps.length,
      hasCount: count !== null,
      ready: count?.classList.contains('con-start__count--ready') ?? false,
      title: stdpTitle || strandedTitle, hasEM,
    };
  }, EM);
}

test('EstablishedMethods: both std-project prompts served by .con-stdp, never stranded', async ({page, request}) => {
  test.setTimeout(600_000);
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  const pid = model.players[0].id;
  const serverTitle = async (): Promise<string> => {
    try {
      const r = await request.get(`/api/player?id=${pid}`);
      const v = await r.json() as {waitingFor?: {title?: string | {message?: string}}};
      const t = v.waitingFor?.title;
      return (typeof t === 'string' ? t : t?.message) ?? '(none)';
    } catch {
      return '(err)';
    }
  };
  await page.goto(`/player?id=${pid}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);

  const trace: Array<string> = [];
  const stranded: Array<string> = [];
  // Per server-prompt outcome: was the std sheet shown, was the guard shown.
  const promptOutcomes = new Map<string, {stdp: boolean, stranded: boolean}>();
  let picks = 0;

  for (let i = 0; i < 55; i++) {
    const s = await snap(page);
    const st = await serverTitle();
    trace.push(`#${i} srv="${st}" start=${s.start} step=${s.activeStep}/${s.steps} count=${s.hasCount}/${s.ready} EM=${s.hasEM} stdp=${s.stdp} stranded=${s.stranded}`);

    // When the server is on a std-project prompt, record what the console shows.
    const isStdPrompt = /standard project/i.test(st);
    if (isStdPrompt) {
      const prev = promptOutcomes.get(st) ?? {stdp: false, stranded: false};
      // DWELL: the leak detector needs STRANDED_CONFIRM_TICKS (2) × 1s of the
      // prompt being unserved before it shows the guard. Give it >2s on the
      // open sheet — without the .con-stdp fix the guard appears here.
      for (let d = 0; d < 4; d++) {
        const ds = await snap(page);
        prev.stdp = prev.stdp || ds.stdp;
        prev.stranded = prev.stranded || ds.stranded;
        if (ds.stranded) {
          await page.screenshot({path: `test-results/em-stranded-${i}-${d}.png`});
        }
        await page.waitForTimeout(750);
      }
      promptOutcomes.set(st, prev);
      if (prev.stdp) {
        await page.screenshot({path: `test-results/em-stdp-${i}.png`});
      }
      // Pick the focused (first available) standard project → pick + pay.
      await key(page, 'Enter', 1500);
      continue;
    }
    if (s.stranded) {
      stranded.push(`#${i} srv="${st}"`);
      await page.screenshot({path: `test-results/em-stranded-${i}.png`});
    }

    if (s.start) {
      if (s.hasCount && !s.ready) {
        if (s.hasEM && !(await isPicked(page, EM))) {
          await pickCard(page, EM); // guarantee Established Methods is chosen
        } else {
          // pick the leftmost unpicked card to satisfy the count
          const list = await slots(page);
          const other = list.find((n) => n !== EM) ?? list[0];
          await pickCard(page, other);
        }
      } else if (s.steps === 0) {
        // The play-your-corporation / play-preludes SEQUENCE (no step rail).
        // Deliberate, slow presses: focus the leftmost (corp / next prelude),
        // then A to play. Animations (deal / hero) must settle between presses.
        await page.waitForTimeout(1000);
        await key(page, 'ArrowLeft', 400);
        await key(page, 'Enter', 2000);
      } else if (s.activeStep >= 0 && s.activeStep === s.steps - 1) {
        await key(page, 'Enter', 1600); // summary → launch
      } else {
        await key(page, 'KeyE', 700); // corp done / projects: buy nothing
      }
      continue;
    }

    // Post-sequence, not on a std prompt: both projects done → stop once the
    // server has left the std-project prompts (guard against an infinite tail).
    if (!s.start && promptOutcomes.size >= 2) {
      break;
    }
    await key(page, 'Enter', 800);
    picks++;
    if (picks > 40) {
      break;
    }
  }

  console.log('TRACE:\n' + trace.join('\n'));
  console.log('PROMPT OUTCOMES: ' + [...promptOutcomes.entries()].map(([k, v]) => `"${k}" stdp=${v.stdp} stranded=${v.stranded}`).join(' || '));

  const first = [...promptOutcomes.entries()].find(([k]) => /first standard project/i.test(k));
  const second = [...promptOutcomes.entries()].find(([k]) => /second standard project/i.test(k));
  expect(first, `never reached the FIRST std-project prompt; seen=[${[...promptOutcomes.keys()].join('|')}]`).toBeTruthy();
  expect(second, `never reached the SECOND std-project prompt; seen=[${[...promptOutcomes.keys()].join('|')}]`).toBeTruthy();
  // The fix: BOTH prompts must be served by the .con-stdp screen, never the
  // stranded guard.
  expect(first?.[1].stranded, 'FIRST std-project prompt showed the stranded guard').toBeFalsy();
  expect(second?.[1].stranded, 'SECOND std-project prompt showed the stranded guard').toBeFalsy();
  expect(first?.[1].stdp, 'FIRST std-project prompt never opened .con-stdp').toBeTruthy();
  expect(second?.[1].stdp, 'SECOND std-project prompt never opened .con-stdp').toBeTruthy();
  expect(stranded, `stranded guard appeared outside std prompts: ${stranded.join(', ')}`).toEqual([]);
});
