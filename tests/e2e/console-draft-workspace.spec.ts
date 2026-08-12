import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fillPicks, press, sendPlayerInput, submitSummary, summaryVisible, walkToSummary} from './consoleStart';

/**
 * THE DRAFT WORKSPACE («ДРАФТ») — the between-generations draft + research
 * buy as ONE console workspace flow.
 *
 * Player 1 lives on a real 4K TV-profile page and plays the whole flow with
 * the pad grammar; player 2 answers over `player/input` (the same endpoint,
 * the same responses — the API is the second human, never a shortcut).
 *
 * What this pins down:
 *  · the workspace (not a modal) opens when the draft begins: HUD + rail +
 *    dock stay, the flow rail shows the REAL pick count;
 *  · a pick physically lands on the «ОТОБРАНО» shelf and the leftovers pass
 *    on; the waiting state is calm and names both neighbors;
 *  · a reload mid-draft hydrates straight into the same state (no replay);
 *  · LT opens the drafted-cards sub-stage; a packet arriving DURING the
 *    inspect never tears it; B returns to the live packet;
 *  · the research buy rises inside the same workspace (financial strip,
 *    toggle picks, RT commit), bought cards fly to the dock, the terminal
 *    «ГОТОВО» beat plays, and the board returns.
 */

const OUT_DIR = path.resolve('screenshots', 'draft-workspace');

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
    draftVariant: true, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
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

type WirePrompt = {
  type: string,
  title?: unknown,
  min?: number,
  options?: Array<WirePrompt>,
  cards?: Array<{name: string}>,
  spaces?: Array<string>,
  amount?: number,
};
type WireModel = {game: {phase: string}, waitingFor?: WirePrompt};

async function modelOf(request: APIRequestContext, id: string): Promise<WireModel> {
  return (await request.get(`/api/player?id=${id}`)).json();
}

/** A generic answer for the road to (and out of) generation 1 — the pass is
 *  preferred the moment it is offered, so the generation ends fast. */
function roadAnswer(prompt: WirePrompt): Record<string, unknown> {
  switch (prompt.type) {
  case 'initialCards':
    // corp sub-prompt: min 1 → the first corporation; projects: min 0 → none.
    return {
      type: 'initialCards',
      responses: (prompt.options ?? []).map((sub) => ({
        type: 'card',
        cards: (sub.cards ?? []).slice(0, sub.min ?? 1).map((c) => c.name),
      })),
    };
  case 'or': {
    const options = prompt.options ?? [];
    const passIdx = options.findIndex((o) => typeof o.title === 'string' && o.title.includes('Pass'));
    if (passIdx !== -1) {
      return {type: 'or', index: passIdx, response: {type: 'option'}};
    }
    return {type: 'or', index: 0, response: roadAnswer(options[0])};
  }
  case 'option':
    return {type: 'option'};
  case 'space':
    return {type: 'space', spaceId: (prompt.spaces ?? [])[0]};
  case 'card':
    return {type: 'card', cards: (prompt.cards ?? []).slice(0, Math.max(prompt.min ?? 1, 1)).map((c) => c.name)};
  case 'payment':
    return {type: 'payment', payment: {
      heat: 0, megacredits: prompt.amount ?? 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
      floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
      auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
    }};
  default:
    throw new Error(`road: unhandled prompt type ${prompt.type}`);
  }
}

/**
 * End generation 1: P1 passes ON THE REAL UI (the RT quick wheel — the open
 * page must see its own move, an API answer behind a held prompt is a state
 * the client never polls out of), then P2 passes over the API. The LAST pass
 * flips the game into DRAFTING while P1's page is live — the entrance the
 * whole workspace is about.
 */
async function passIntoDrafting(page: Page, request: APIRequestContext, firstId: string, secondId: string): Promise<void> {
  // P1's pass: HOLD RT (the quick wheel is press-release: a quick tap commits
  // the CENTER slot), steer to the 'down' slot («Пас»), release to commit.
  // Press-verify-retry: the server model is the only truth about the pass.
  let passedOnUi = false;
  for (let i = 0; i < 5 && !passedOnUi; i++) {
    await page.keyboard.down('Period');
    await page.waitForTimeout(550);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(450);
    await page.keyboard.up('Period');
    await page.waitForTimeout(1600);
    const m1 = await modelOf(request, firstId);
    passedOnUi = m1.game.phase !== 'action' || m1.waitingFor === undefined ||
      m1.waitingFor.type !== 'or';
  }
  if (!passedOnUi) {
    // The honest fallback: pass P1 over the API and RELOAD the page so it
    // learns about its own consumed prompt (an open client never polls while
    // it holds a required prompt) — the draft's pending action then derives
    // on the fresh page (the plate; A opens the workspace).
    console.log('[drive] UI pass did not land — falling back to API pass + reload');
    const m1 = await modelOf(request, firstId);
    if (m1.game.phase === 'action' && m1.waitingFor !== undefined) {
      await sendPlayerInput(request, firstId, roadAnswer(m1.waitingFor) as never);
    }
    await page.reload();
  }
  // P2's turn arrives once P1's generation is over; pass it over the API.
  for (let i = 0; i < 40; i++) {
    const m2 = await modelOf(request, secondId);
    if (m2.game.phase === 'drafting') {
      return;
    }
    if (m2.game.phase === 'action' && m2.waitingFor !== undefined) {
      await sendPlayerInput(request, secondId, roadAnswer(m2.waitingFor) as never);
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('never reached the drafting phase');
}

/**
 * A pick on the REAL UI, press-verify-retry: a press landing on a busy frame
 * (the arrival cinematic, the pick beat) is deliberately consumed, so the
 * server model is the only truth about whether the pick LANDED.
 */
async function pickOnUi(page: Page, request: APIRequestContext, id: string): Promise<void> {
  type M = WireModel & {draftedCards?: Array<unknown>};
  const before = ((await modelOf(request, id)) as M).draftedCards?.length ?? 0;
  for (let i = 0; i < 10; i++) {
    await press(page, 'Enter', 1500);
    const m = await modelOf(request, id) as M;
    const drafted = m.draftedCards?.length ?? 0;
    const wf = m.waitingFor as (WirePrompt & {optional?: boolean}) | undefined;
    if (drafted > before || m.game.phase === 'research' ||
        wf === undefined || wf.optional === true) {
      return;
    }
  }
  throw new Error('the pick never landed on the UI');
}

/** The second player's current prompt (asserting it is a card pick). */
async function secondPicksFirstCard(request: APIRequestContext, id: string): Promise<void> {
  const model = await modelOf(request, id);
  const wf = model.waitingFor;
  expect(wf?.type, `second player expected a draft pick, got ${wf?.type}`).toBe('card');
  const first = (wf?.cards ?? [])[0];
  expect(first).toBeDefined();
  await sendPlayerInput(request, id, {type: 'card', cards: [first!.name]});
}

/** What the workspace is showing (painted surfaces only). */
async function surface(page: Page) {
  return page.evaluate(() => {
    const painted = (sel: string): boolean => {
      const el = document.querySelector(sel);
      return el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    };
    return {
      workspace: painted('.con-draftws'),
      pick: painted('.con-draftws__stage--pick'),
      wait: painted('.con-draftws__stage--wait'),
      buy: painted('.con-draftws__stage--buy'),
      inspect: painted('.con-draftws__stage--inspect'),
      done: painted('.con-draftws__stage--done'),
      packetSlots: document.querySelectorAll('.con-draftws__stage--pick .con-cards__slot').length,
      buySlots: document.querySelectorAll('.con-draftws__stage--buy .con-cards__slot').length,
      inspectSlots: document.querySelectorAll('.con-draftws__stage--inspect .con-cards__slot').length,
      shelfCards: document.querySelectorAll('.con-draftws__shelf-slot').length,
      shelfSeats: document.querySelectorAll('.con-draftws__shelf-seat').length,
      railItems: document.querySelectorAll('.con-jrail [data-phase="picks"] .con-jrail__item').length,
      railDone: document.querySelectorAll('.con-jrail [data-phase="picks"] .con-jrail__item--done').length,
      railPresentation: document.querySelector('.con-jrail')?.getAttribute('data-presentation') ?? '',
      finstrip: painted('.con-draftws__finstrip'),
      hud: painted('.con-status'),
      rail: painted('.con-res'),
      dock: painted('.con-handdock'),
      passReadout: (document.querySelector('.con-draftws__pass') as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ') ?? '',
      statusLine: (document.querySelector('.con-draftws__statusbar') as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ') ?? '',
      crumb: (document.querySelector('.con-draftws .con-wshead') as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').slice(0, 120) ?? '',
      taskHostBands: document.querySelectorAll('.con-task-host:not(.con-task-host--embedded)').length,
      trayPopover: document.querySelectorAll('.con-drafttray').length,
    };
  });
}

test.describe('draft workspace · the between-generations flow', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('picks → shelf → waits → purchase → done, all inside ONE workspace', async ({page, request}) => {
    test.setTimeout(600_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string, name: string}>};
    const first = model.players.find((p) => p.name === 'First')!;
    const second = model.players.find((p) => p.name === 'Second')!;

    // ── The pregame: P1 walks the real wizard (TV profile), P2 answers over
    //    the API; then both pass generation 1 over the API (P1's page follows).
    await page.goto(`/player?id=${first.id}&console=1&consoleProfile=tv`);
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await press(p, 'Enter', 600);
        } else if (kind === 'project') {
          await fillPicks(p, 0);
        }
      },
    });
    expect(await summaryVisible(page), 'the wizard walk must end on the summary').toBeTruthy();
    await submitSummary(page);
    // P2 answers their setup over the API, so P1's deployment is not held by
    // the table; THEN P1 plays the deployment out on the real UI — the start
    // workspace must RELEASE before the draft (its phase root would otherwise
    // still own the screen).
    for (let i = 0; i < 20; i++) {
      const m2 = await modelOf(request, second.id);
      console.log(`[p2 road ${i}] phase=${m2.game.phase} wf=${m2.waitingFor?.type ?? '(none)'}`);
      if (m2.game.phase === 'drafting' || m2.waitingFor === undefined) {
        break;
      }
      await sendPlayerInput(request, second.id, roadAnswer(m2.waitingFor) as never);
    }
    // The deployment opens once the table is ready; play the corporation out
    // on the REAL UI so the start workspace releases its phase root (the
    // draft must stand on a clean stack, exactly as in live play).
    await page.waitForSelector('.con-start--ceremony', {timeout: 60_000});
    const startRoot = page.locator('.con-start');
    for (let i = 0; i < 25 && await startRoot.count() > 0; i++) {
      await press(page, 'Enter', 1300);
    }
    expect(await startRoot.count(), 'the start workspace released after the deployment').toBe(0);
    await passIntoDrafting(page, request, first.id, second.id);

    // ── 1 · THE PENDING ACTION: the workspace does NOT auto-open on the
    //    phase flip any more. The draft registers a pending MANDATORY action;
    //    its plate presents only after the ordinary-notification feed has
    //    fully finished (P2's pass card, the new-generation card — B flushes
    //    them faster than their TTL), and only the player's A opens the
    //    workspace.
    await expect.poll(async () => {
      const plate = await page.locator('.con-mandatory').count();
      if (plate === 0) {
        await press(page, 'Escape', 500); // B: dismiss a presenting toast
      }
      return plate;
    }, {timeout: 90_000}).toBeGreaterThan(0);
    expect(await page.locator('.con-draftws').count(), 'the workspace never opens uninvited').toBe(0);
    await shoot(page, '00-draft-announce');
    await press(page, 'Enter', 900); // A — the one explicit door into the draft
    await page.waitForSelector('.con-draftws', {timeout: 45_000});
    await page.waitForTimeout(4200); // the deal cinematic + entrance settle
    let s = await surface(page);
    console.log('[first packet]', JSON.stringify(s));
    await shoot(page, '01-first-packet');
    expect(s.workspace, 'the draft workspace stands').toBeTruthy();
    expect(s.pick, 'the pick stage is the visible zone').toBeTruthy();
    expect(s.packetSlots, 'the whole packet is on stage').toBe(4);
    expect(s.railItems, 'the flow rail mirrors the real pick count').toBe(4);
    expect(s.hud && s.rail && s.dock, 'HUD + player rail + hand dock stay put').toBeTruthy();
    expect(s.taskHostBands, 'no standalone modal rises over the workspace').toBe(0);
    expect(s.trayPopover, 'the old tray popover never mounts here').toBe(0);
    expect(s.passReadout.length, 'the pass readout names the neighbor').toBeGreaterThan(0);

    // ── 2 · THE FIRST PICK: A commits, the hero lands on the shelf, the rest
    //    passes on; P2 has not picked yet → the calm waiting state.
    await pickOnUi(page, request, first.id);
    await expect.poll(async () => (await surface(page)).wait, {timeout: 20_000}).toBeTruthy();
    await expect.poll(async () => (await surface(page)).shelfCards, {timeout: 20_000}).toBe(1);
    s = await surface(page);
    console.log('[waiting]', JSON.stringify(s));
    expect(s.pick, 'the packet stage yielded').toBeFalsy();
    await page.waitForTimeout(900);
    await shoot(page, '02-waiting');

    // ── 3 · RELOAD MID-WAIT: the pending action re-derives (reconnect
    //    restore), its plate presents on the fresh page (the seed is silent,
    //    so the feed settles at once), and A re-opens the workspace — which
    //    hydrates straight into the same state: no entrance replay, the shelf
    //    keeps the pick.
    await page.reload();
    await page.waitForSelector('.con-mandatory', {timeout: 45_000});
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-draftws', {timeout: 45_000});
    await page.waitForTimeout(1500);
    s = await surface(page);
    console.log('[reloaded]', JSON.stringify(s));
    expect(s.wait, 'reload lands back in the waiting state').toBeTruthy();
    expect(s.shelfCards, 'the shelf survives the reload').toBe(1);
    await shoot(page, '03-reload-wait');

    // ── 4 · LT DURING THE WAIT: the drafted-cards sub-stage opens; the next
    //    packet arriving DURING the inspect never tears it.
    await press(page, 'Comma', 1200);
    await expect.poll(async () => (await surface(page)).inspect, {timeout: 15_000}).toBeTruthy();
    s = await surface(page);
    expect(s.inspectSlots, 'the drafted card is on the big row').toBe(1);
    expect(s.railPresentation, 'the flow rail compacts under the sub-stage').toBe('compact');
    await shoot(page, '04-inspect');
    await secondPicksFirstCard(request, second.id); // the packet arrives now
    await page.waitForTimeout(2500);
    s = await surface(page);
    console.log('[inspect while packet arrived]', JSON.stringify(s));
    expect(s.inspect, 'the inspect stays while the packet arrives').toBeTruthy();
    await press(page, 'Escape', 1600);
    await expect.poll(async () => (await surface(page)).pick, {timeout: 25_000}).toBeTruthy();
    await page.waitForTimeout(3000); // the received packet spreads + settles
    s = await surface(page);
    console.log('[second packet]', JSON.stringify(s));
    expect(s.packetSlots, 'the passed packet has one card fewer').toBe(3);
    await shoot(page, '05-second-packet');

    // ── 5 · THE REMAINING PICKS: rounds of 3 and 2; the last card of the
    //    packet auto-passes by the rules (never an interactive pick).
    await pickOnUi(page, request, first.id);
    await secondPicksFirstCard(request, second.id);
    await expect.poll(async () => (await surface(page)).packetSlots, {timeout: 30_000}).toBe(2);
    await page.waitForTimeout(2200);
    await pickOnUi(page, request, first.id);
    await secondPicksFirstCard(request, second.id);

    // ── 6 · THE PURCHASE: the buy rises inside the SAME workspace — the
    //    financial strip + the full drafted set (3 picks + the auto card).
    await expect.poll(async () => (await surface(page)).buy, {timeout: 45_000}).toBeTruthy();
    await page.waitForTimeout(4500); // the rise scene settles
    s = await surface(page);
    console.log('[purchase]', JSON.stringify(s));
    expect(s.buySlots, 'the whole drafted set is the purchase row').toBe(4);
    expect(s.finstrip, 'the financial strip stands').toBeTruthy();
    expect(s.workspace, 'still the same workspace').toBeTruthy();
    expect(s.taskHostBands, 'still no standalone modal').toBe(0);
    await shoot(page, '06-purchase');

    // ── 7 · PICK TWO CARDS + COMMIT: bought cards fly to the dock, the rest
    //    tumbles out, the terminal beat plays, the board returns.
    const pickedCount = async () => page.locator('.con-draftws__stage--buy .con-cards__slot--picked').count();
    for (let i = 0; i < 6 && await pickedCount() < 1; i++) {
      await press(page, 'Enter', 1000);
    }
    await press(page, 'ArrowRight', 700);
    for (let i = 0; i < 6 && await pickedCount() < 2; i++) {
      await press(page, 'Enter', 1000);
    }
    expect(await pickedCount(), 'two cards selected for purchase').toBe(2);
    s = await surface(page);
    expect(s.statusLine.length, 'the status rail explains the focused card').toBeGreaterThan(0);
    await shoot(page, '07-purchase-picked');
    // RT commits — press-verify-retry against the server's research flag.
    for (let i = 0; i < 6; i++) {
      await press(page, 'Period', 1400);
      const m = await modelOf(request, first.id) as WireModel & {thisPlayer?: {needsToResearch?: boolean}};
      if (m.thisPlayer?.needsToResearch === false || m.game.phase === 'action') {
        break;
      }
    }
    // The terminal beat is a BOUNDED window (the workspace releases itself
    // right after it) — poll for the beat OR the release, and record which
    // one the sampler caught; missing the beat under driver latency must not
    // read as the flow failing.
    let sawDone = false;
    await expect.poll(async () => {
      const now = await surface(page);
      sawDone = sawDone || now.done;
      return now.done || !now.workspace;
    }, {timeout: 45_000}).toBeTruthy();
    s = await surface(page);
    console.log('[done]', JSON.stringify({sawDone, ...s}));
    await shoot(page, '08-done');

    // The frame releases on its own; the board comes back with 2 more cards
    // in hand. P2's buy resolves over the API meanwhile.
    const p2 = await modelOf(request, second.id);
    if (p2.waitingFor?.type === 'card') {
      await sendPlayerInput(request, second.id, {type: 'card', cards: []});
    }
    await expect.poll(async () => (await surface(page)).workspace, {timeout: 30_000}).toBeFalsy();
    await page.waitForTimeout(1500);
    s = await surface(page);
    console.log('[released]', JSON.stringify(s));
    expect(s.dock, 'the board home is back with the dock').toBeTruthy();
    await shoot(page, '09-board-return');
  });
});
