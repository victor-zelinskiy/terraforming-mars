import {test, expect, Page} from '@playwright/test';
import {
  press, stepKind, stepSubject, waitPressable, summaryVisible, pickCards,
  submitSummary, queueCards, waitQueueIdle,
} from './consoleStart';

/** TEMPORARY diagnostic: when exactly does each prelude leave the queue? */

const WAITING = 'Double Down';
const ENABLER = 'Business Empire';

function cfg() {
  return {
    players: [{name: 'Probe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [WAITING, ENABLER, 'Metal-Rich Asteroid', 'Mohole Excavation'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

async function reachDeployment(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await page.waitForTimeout(250);
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      await press(page, 'Enter', 600);
    } else if (kind === 'prelude') {
      await pickCards(page, [WAITING, ENABLER]);
    }
    await press(page, 'Period', 1600);
    for (let w = 0; w < 20 && !(await summaryVisible(page)) &&
         stepKind(await stepSubject(page)) === kind; w++) {
      await page.waitForTimeout(250);
    }
  }
  await submitSummary(page);
  await page.waitForSelector('.con-start__queue', {timeout: 45_000});
}

async function focusQueue(page: Page, card: string): Promise<boolean> {
  const focused = async () => page.evaluate(() =>
    document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
  let dir: 'ArrowRight' | 'ArrowLeft' = 'ArrowRight';
  for (let i = 0; i < 10; i++) {
    const at = await focused();
    if (at === card) {
      return true;
    }
    await press(page, dir, 260);
    if (await focused() === at) {
      dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
    }
  }
  return await focused() === card;
}

test.describe('probe', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('queue timeline around the hold commit', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {data: cfg()});
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await reachDeployment(page);

    for (let round = 0; round < 14; round++) {
      await waitQueueIdle(page);
      const q = await queueCards(page);
      const setup = q.filter((n) => n !== WAITING && n !== ENABLER);
      if (setup.length === 0 && q.length > 0) {
        break;
      }
      if (setup.length > 0 && await focusQueue(page, setup[0])) {
        await waitPressable(page);
        await press(page, 'Enter', 1500);
      }
      await page.waitForTimeout(600);
    }

    expect(await focusQueue(page, WAITING)).toBeTruthy();
    await waitQueueIdle(page);
    await waitPressable(page);
    await press(page, 'Enter', 900);
    // eslint-disable-next-line no-console
    console.log('[probe] stage up:', await page.evaluate(() =>
      document.querySelector('[data-start-risk]') !== null));

    const t0 = Date.now();
    const sample = async (tag: string) => {
      const s = await page.evaluate(() => ({
        queue: Array.from(document.querySelectorAll('.con-start__qcard'))
          .map((el) => el.getAttribute('data-queue-slot') ?? ''),
        played: Array.from(document.querySelectorAll('[data-played-key]'))
          .map((el) => el.getAttribute('data-played-key') ?? ''),
        focused: document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '',
        armed: document.querySelector('.con-start__qcard--armed')?.getAttribute('data-queue-slot') ?? '',
        stage: document.querySelector('[data-start-risk]') !== null,
      }));
      // eslint-disable-next-line no-console
      console.log(`[probe] ${String(Date.now() - t0).padStart(5)}ms ${tag}`, JSON.stringify(s));
    };

    // Reproduce the SPEC's exact sequence: an aborted hold, then the real one.
    await sample('before-abort');
    await page.keyboard.down('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.up('Enter');
    await page.waitForTimeout(600);
    await sample('after-abort');
    await page.keyboard.down('Enter');
    await page.waitForTimeout(1100);
    await page.keyboard.up('Enter');
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(400);
      await sample(`after-commit+${(i + 1) * 400}`);
    }
  });
});
