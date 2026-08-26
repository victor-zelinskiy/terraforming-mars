import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fetchPlayerModel, fillPicks, openConsole, payStartPurchase, pickCalmCorporation, playQueueCard,
  press, queueCards, sendPlayerInput, submitSummary, summaryVisible, waitQueueIdle, walkToSummary,
} from './consoleStart';

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

/**
 * THE DOCK'S OWN READOUT — painted, its LANDED total («КАРТЫ x/N» excludes
 * withheld cards by contract), and how many backs are still withheld. The
 * landing is what the delivery beat is for, so «the element exists» proves
 * nothing: a held back is `visibility:hidden` and out of the count.
 */
async function dockState(page: Page): Promise<{painted: boolean, total: number, held: number}> {
  return page.evaluate(() => {
    const dock = document.querySelector('.con-handdock');
    return {
      painted: dock !== null &&
        (dock as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true}),
      total: Number.parseInt((document.querySelector('.con-handdock__num--total')?.textContent ?? '').trim(), 10) || 0,
      held: document.querySelectorAll('.con-handbody--held, .con-handbody:not([data-hand-body-mode="docked"])').length,
    };
  });
}

/**
 * Answer ONE player's setup wizard over the API and stop there — they are
 * left holding their own `corporationPlay` prompt.
 *
 * That is the whole point: `Game.playerIsFinishedWithResearchPhase` releases
 * the research barrier PER PLAYER, so an unplayed seat pins the TABLE in
 * gen-1 RESEARCH while the other player walks their entire deployment. Each
 * sub-prompt takes its own minimum (one corporation, zero projects), the same
 * shape the real client posts.
 */
async function answerWizardOnly(request: APIRequestContext, playerId: string): Promise<void> {
  const model = await fetchPlayerModel(request, playerId);
  const prompt = model.waitingFor;
  expect(prompt?.type, 'the second seat opens on its setup wizard').toBe('initialCards');
  await sendPlayerInput(request, playerId, {
    type: 'initialCards',
    responses: (prompt?.options ?? []).map((step) => ({
      type: 'card',
      cards: (step.cards ?? []).map((c) => c.name).slice(0, step.min ?? 0),
    })),
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
  const onSummary = await summaryVisible(page);
  const deploymentAlready = (await surface(page)).deployment;
  // The final RT and solo page polling can straddle the commit hand-off: when
  // the other player is already ready, this page may paint deployment before
  // the driver samples the summary. Do not inject a second A into that live
  // corporation beat; both poses prove this player submitted successfully.
  expect(onSummary || deploymentAlready).toBeTruthy();
  if (onSummary) {
    await submitSummary(page);
  }
}

test.describe('start · two humans hand over together', () => {
  // The first submitter's waiting/commit pose is a primary couch-distance
  // acceptance frame for the two-tier Start Game header.
  test.use({viewport: {width: 3840, height: 2160}});

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
    // A full 4K frame can take longer than the old fixed post-key delay to
    // paint the board-side mandatory announcement. Observe the canonical
    // state with a ceiling instead of sampling a compositor-dependent frame.
    await expect.poll(async () => (await surface(page)).announce, {timeout: 15_000}).toBeTruthy();
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

  /**
   * THE PAYMENT WINDOW — the multiplayer-only frame the dock used to vanish in.
   *
   * A player who has played their corporation AND paid for their bought
   * projects is done, but the TABLE is not: the research barrier holds
   * `Phase.RESEARCH` until the last seat has done the same. So this player
   * sits in gen-1 RESEARCH with `waitingFor === undefined` — the exact triple
   * the dock's birth gate used to read as «no hand yet» — at the precise
   * moment `runHandDelivery` is flying their paid cards INTO the dock. The
   * dock went `display:none`, `stableTargetRect` polled a zero-width rect for
   * its whole budget, and the starting hand landed nowhere.
   *
   * Solo vs MarsBot cannot express this: `gotoInitialResearchPhase` pre-seeds
   * the bot into `researchedPlayers`, so the human's own confirm flips the
   * phase in the same response and the window has zero length. Hence a second
   * HUMAN seat, deliberately parked on its unanswered corporation play.
   */
  test('the payer WAITS on the table — the dock stays and the paid cards land in it', async ({page, request}) => {
    test.setTimeout(420_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string, name: string}>};
    const first = model.players.find((p) => p.name === 'First')!;
    const second = model.players.find((p) => p.name === 'Second')!;

    // SECOND answers only its wizard and then stops — the table's anchor in
    // RESEARCH for the whole test.
    await answerWizardOnly(request, second.id);

    // FIRST buys two projects; with both seats picked the deployment opens at
    // the summary submit.
    await openConsole(page, first.id);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await pickCalmCorporation(p);
        } else if (kind === 'project') {
          await fillPicks(p, 2);
        }
      },
    });
    await submitSummary(page);
    await expect.poll(async () => (await surface(page)).deployment, {timeout: 90_000}).toBeTruthy();

    // Play the corporation, then press «ОПЛАТИТЬ» — the beat that fires the
    // starting-cards delivery.
    await waitQueueIdle(page);
    const queue = await queueCards(page);
    expect(queue.length, 'the deployment stands with the corporation to play').toBeGreaterThan(0);
    expect(await playQueueCard(page, queue[0]), `the corporation ${queue[0]} was played`).toBeTruthy();
    expect(await payStartPurchase(page), 'the purchase was paid').toBeTruthy();
    await shoot(page, '05-first-paid-while-table-waits');

    // THE WINDOW IS REAL — pinned on the SERVER, so this can never pass by
    // racing past the state it is about.
    const paid = await fetchPlayerModel(request, first.id);
    expect(paid.game.phase, 'the table is still in gen-1 research (the other seat has not played)').toBe('research');
    expect(paid.waitingFor, 'and the server asks this player for nothing').toBeUndefined();

    // THE CLAIM: the dock is there, and the two paid cards physically LANDED
    // in it (the delivery releases each back on its own touchdown, so the
    // «КАРТЫ» total reaching 2 is the landing, not the server's hand).
    await expect.poll(async () => (await dockState(page)).total, {timeout: 30_000}).toBe(2);
    const landed = await dockState(page);
    console.log('[first paid, table still researching]', JSON.stringify(landed));
    expect(landed.painted, 'the dock never hides while the table finishes its setup').toBeTruthy();
    expect(landed.held, 'no back is left withheld — every paid card touched down').toBe(0);
  });
});
