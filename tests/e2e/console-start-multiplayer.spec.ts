import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fillPicks, press, submitSummary, summaryVisible, walkToSummary} from './consoleStart';

/**
 * THE MULTIPLAYER START HANDS OVER TOGETHER.
 *
 * A submitted setup is NOT a started game: the server holds the whole table
 * until every player has confirmed. The console must say exactly that — the
 * player who finished first STAYS on their summary in a WAITING state (their
 * picks final, nothing asked of them) and the deployment opens for everyone
 * at the same moment, fully functional (hand dock included).
 *
 * The shipped bug this pins down: the first player was thrown into an EMPTY
 * deployment with no hand dock, could not return to it once minimized, and
 * even after the others finished the dock never came back — every take
 * animation aimed at a target that was not there.
 */

const OUT_DIR = path.resolve('screenshots', 'start-mp');

function newGameConfig() {
  return {
    players: [
      {name: 'First', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Second', color: 'green', beginner: false, handicap: 0, first: false},
    ],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** What the player is actually looking at (painted surfaces only). */
async function surface(page: Page): Promise<{
  summary: boolean, awaiting: boolean, deployment: boolean, queue: number,
  dock: boolean, dockLive: boolean, announce: boolean, chip: string,
  flowPresentation: string, selectionFlow: string, deploymentFlow: string,
}> {
  return page.evaluate(() => {
    const painted = (sel: string): boolean => {
      const el = document.querySelector(sel);
      return el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    };
    return {
      summary: painted('.con-start > .con-start__frame .con-start__summary'),
      awaiting: painted('.con-start__await'),
      // The deployment = the ceremony shell (bounded band + its queue row).
      deployment: painted('.con-start--ceremony'),
      queue: document.querySelectorAll('.con-start__queue [data-queue-slot]').length,
      dock: painted('.con-handdock'),
      dockLive: document.querySelectorAll('.con-handdock--live').length > 0,
      announce: painted('.con-mandatory'),
      chip: (document.querySelector('.con-status__players') as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').slice(0, 80) ?? '',
      flowPresentation: document.querySelector('.con-jrail')?.getAttribute('data-presentation') ?? '',
      selectionFlow: document.querySelector('[data-phase="selection"]')?.className ?? '',
      deploymentFlow: document.querySelector('[data-phase="deployment"]')?.className ?? '',
    };
  });
}

async function setUpAndSubmit(page: Page, id: string, buy: number): Promise<void> {
  await page.goto(`/player?id=${id}&console=1`);
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'project') {
        await fillPicks(p, buy);
      }
    },
  });
  expect(await summaryVisible(page)).toBeTruthy();
  await submitSummary(page);
}

test.describe('start · two humans hand over together', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the first submitter WAITS on the summary and the deployment opens functional for both', async ({page, request, browser}) => {
    test.setTimeout(420_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string, name: string}>};
    const first = model.players.find((p) => p.name === 'First')!;
    const second = model.players.find((p) => p.name === 'Second')!;

    // ── FIRST submits while SECOND is still picking.
    await setUpAndSubmit(page, first.id, 2);
    await page.waitForTimeout(2500);
    await shoot(page, '01-first-after-submit');

    // 1 · The workspace STAYS on the summary in its waiting state — never an
    //     empty deployment, never a dead end.
    const waiting = await surface(page);
    console.log('[first after submit]', JSON.stringify(waiting));
    expect(waiting.deployment, 'no deployment before everyone is ready').toBeFalsy();
    expect(waiting.summary || waiting.awaiting, 'the summary keeps the player').toBeTruthy();
    expect(waiting.flowPresentation, 'the same expanded flow remains while waiting').toBe('expanded');
    expect(waiting.selectionFlow, 'the committed selection shows its waiting bridge').toContain('con-jrail__phase--waiting');
    expect(waiting.deploymentFlow, 'deployment stays locked before the table is ready').toContain('con-jrail__phase--locked');

    // 2 · MINIMIZED, the player can come back: the board announces the start
    //     as the pending mandatory beat.
    await press(page, 'Escape', 1500);
    const minimized = await surface(page);
    console.log('[first minimized]', JSON.stringify(minimized));
    await shoot(page, '02-first-minimized');
    expect(minimized.announce, 'the minimized start is announced on the board').toBeTruthy();
    // A returns to it.
    await press(page, 'Enter', 1500);
    expect((await surface(page)).summary || (await surface(page)).awaiting,
      'A returns to the waiting summary').toBeTruthy();

    // ── SECOND finishes their setup in another context.
    const secondPage = await (await browser.newContext({viewport: {width: 1920, height: 1080}})).newPage();
    await setUpAndSubmit(secondPage, second.id, 2);
    await secondPage.waitForTimeout(3000);

    // 3 · …and NOW the deployment opens — for the first player too, with a
    //     functional hand dock (the take flights have a real target).
    await expect.poll(async () => (await surface(page)).deployment, {timeout: 60_000}).toBeTruthy();
    await page.waitForTimeout(2500);
    await shoot(page, '03-first-deployment');
    const live = await surface(page);
    console.log('[first deployment]', JSON.stringify(live));
    expect(live.queue, 'the deployment really has the start queue').toBeGreaterThan(0);
    expect(live.dock, 'the hand dock exists in the deployment').toBeTruthy();
    expect(live.selectionFlow, 'selection consolidates once deployment opens').toContain('con-jrail__phase--completed');
    expect(live.deploymentFlow, 'deployment unfolds in the same flow').toContain('con-jrail__phase--current');

    await expect.poll(async () => (await surface(secondPage)).deployment, {timeout: 60_000}).toBeTruthy();
    await shoot(secondPage, '04-second-deployment');
    const live2 = await surface(secondPage);
    console.log('[second deployment]', JSON.stringify(live2));
    expect(live2.queue, 'the second player gets the same functional deployment').toBeGreaterThan(0);
    expect(live2.dock, '…with its hand dock').toBeTruthy();
    await secondPage.context().close();
  });
});
