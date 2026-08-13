import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootSeededGame, press} from './consoleStart';

function newGameConfig() {
  return {
    players: [{name: 'Probe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok()).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  return model.players[0].id;
}

const focusedRow = async (page: Page) =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

const diag = (page: Page) => page.evaluate(() => {
  const fn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
  const d = fn !== undefined ? fn() : {};
  return {
    ...d,
    stdpDom: document.querySelectorAll('.con-stdp').length,
    colDom: document.querySelectorAll('.con-colonies').length,
    nested: document.querySelectorAll('.con-stdp .con-colonies').length,
    chips: document.querySelectorAll('.con-stdp .action-effect-chip').length,
    ghost: document.querySelectorAll('.con-status__param--ghost').length,
    context: document.querySelector('.con-stdp__context')?.textContent ?? '',
  };
});

async function focusRow(page: Page, re: RegExp): Promise<void> {
  const snake = [
    'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown',
    'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown',
  ];
  for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
    await press(page, 'ArrowUp', 180);
  }
  if (!re.test(await focusedRow(page))) {
    await press(page, 'ArrowLeft', 180);
  }
  for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
    await press(page, snake[i], 220);
  }
}

test('probe: colony step B semantics', async ({page, request}) => {
  test.setTimeout(300_000);
  page.on('console', (m) => {
    const t = m.text();
    if (/stdp|colony|goBoardHome|conclude/i.test(t)) {
      console.log('PAGE>', t.slice(0, 200));
    }
  });
  const playerId = await createGame(request);
  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: 'Pluto'});
  await page.waitForTimeout(1500);

  await press(page, 'Comma', 1100);
  await press(page, 'Enter', 1400);
  await page.waitForSelector('.con-stdp', {timeout: 15_000});
  await focusRow(page, /астероид/i);
  console.log('BROWSE(asteroid):', JSON.stringify(await diag(page)));

  await focusRow(page, /колония/i);
  console.log('focused row:', await focusedRow(page));
  await press(page, 'Enter', 2400);
  console.log('COLONY STEP:', JSON.stringify(await diag(page)));

  const wf = await (await request.get(`/api/player?id=${playerId}`)).json();
  console.log('waitingFor:', JSON.stringify({
    type: wf.waitingFor?.type,
    placementContext: wf.waitingFor?.placementContext,
  }));

  // Sample the stack every 120 ms across the cancel so the SNAPSHOT that
  // empties it is visible (the end state alone names no culprit).
  const timeline = page.evaluate(() => new Promise<Array<string>>((resolve) => {
    const fn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
    const out: Array<string> = [];
    const t0 = performance.now();
    const tick = () => {
      const d = fn !== undefined ? fn() : {};
      const line = JSON.stringify({
        t: Math.round(performance.now() - t0),
        stack: (d.stack as Array<{kind: string, phase: string}>).map((f) => `${f.kind}:${f.phase}`),
        flow: d.stdpFlow,
        wf: d.wfType,
      });
      if (out[out.length - 1] !== line.replace(/"t":\d+,/, '')) {
        out.push(line);
      }
      if (performance.now() - t0 < 4000) {
        setTimeout(tick, 120);
      } else {
        resolve(out);
      }
    };
    tick();
  }));
  await press(page, 'Escape', 2600);
  console.log('TIMELINE:', (await timeline).join('\n  '));
  console.log('AFTER ESCAPE:', JSON.stringify(await diag(page)));
  const wf2 = await (await request.get(`/api/player?id=${playerId}`)).json();
  console.log('waitingFor2:', JSON.stringify({type: wf2.waitingFor?.type, mc: wf2.megaCredits}));
  await page.screenshot({path: 'screenshots/stdp-probe-after-escape.png'});
});
