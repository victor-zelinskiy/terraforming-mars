import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, fillPicks, press, sendPlayerInput, submitSummary, summaryVisible, walkToSummary} from './consoleStart';

/**
 * DRAFT FINALE PROBE — a fast drive to the draft's closing stretch (the
 * auto-passed last card → the research rise → the buy → the ZERO-BUY exit),
 * recording evidence for the motion-polish iteration:
 *  · screenshots around the rise scene (the arrival + the shelf → row lift);
 *  · a DOM sweep AFTER the zero-buy exit: any element still painting a ring /
 *    outline / box-shadow inside the stage area is the reported «контур
 *    фокуса» artifact.
 * Run with --trace on and read the screencast frames for the motion itself.
 */

const OUT_DIR = path.resolve('screenshots', 'draft-finale');

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
type WireModel = {game: {phase: string}, waitingFor?: WirePrompt, draftedCards?: Array<unknown>, thisPlayer?: {needsToResearch?: boolean}};

async function modelOf(request: APIRequestContext, id: string): Promise<WireModel> {
  return (await request.get(`/api/player?id=${id}`)).json();
}

function roadAnswer(prompt: WirePrompt): Record<string, unknown> {
  switch (prompt.type) {
  case 'initialCards':
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
    return {type: 'payment', payment: {...NO_PAYMENT, megacredits: prompt.amount ?? 0}};
  default:
    throw new Error(`road: unhandled prompt type ${prompt.type}`);
  }
}

async function passIntoDrafting(page: Page, request: APIRequestContext, firstId: string, secondId: string): Promise<void> {
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
    console.log('[drive] UI pass did not land — API pass + reload');
    const m1 = await modelOf(request, firstId);
    if (m1.game.phase === 'action' && m1.waitingFor !== undefined) {
      await sendPlayerInput(request, firstId, roadAnswer(m1.waitingFor) as never);
    }
    await page.reload();
  }
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

async function pickOnUi(page: Page, request: APIRequestContext, id: string): Promise<void> {
  const before = (await modelOf(request, id)).draftedCards?.length ?? 0;
  for (let i = 0; i < 10; i++) {
    await press(page, 'Enter', 1500);
    const m = await modelOf(request, id);
    const drafted = m.draftedCards?.length ?? 0;
    const wf = m.waitingFor as (WirePrompt & {optional?: boolean}) | undefined;
    if (drafted > before || m.game.phase === 'research' ||
        wf === undefined || wf.optional === true) {
      return;
    }
  }
  throw new Error('the pick never landed on the UI');
}

async function secondPicksFirstCard(request: APIRequestContext, id: string): Promise<void> {
  const model = await modelOf(request, id);
  const wf = model.waitingFor;
  expect(wf?.type, `second player expected a draft pick, got ${wf?.type}`).toBe('card');
  const first = (wf?.cards ?? [])[0];
  expect(first).toBeDefined();
  await sendPlayerInput(request, id, {type: 'card', cards: [first!.name]});
}

/** Every visible element inside the workspace body that still paints a ring
 *  (box-shadow / outline) — the ghost sweep after the cards left. */
async function ringSweep(page: Page) {
  return page.evaluate(() => {
    const out: Array<{cls: string, rect: string, shadow: string, outline: string}> = [];
    const root = document.querySelector('.con-draftws');
    const scope = root ?? document.body;
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) {
        continue;
      }
      if (!el.checkVisibility({opacityProperty: true, visibilityProperty: true})) {
        continue;
      }
      const cs = getComputedStyle(el);
      const hasShadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';
      const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0;
      if (!hasShadow && !hasOutline) {
        continue;
      }
      out.push({
        cls: el.className.toString().slice(0, 120),
        rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        shadow: cs.boxShadow.slice(0, 100),
        outline: hasOutline ? `${cs.outlineWidth} ${cs.outlineStyle}` : '',
      });
    }
    return out;
  });
}

test.describe('draft finale probe', () => {
  test.use({viewport: {width: 1920, height: 1080}});
  test.describe.configure({mode: 'serial'});

  test('rise scene + zero-buy exit evidence', async ({page, request}) => {
    test.setTimeout(600_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string, name: string}>};
    const first = model.players.find((p) => p.name === 'First')!;
    const second = model.players.find((p) => p.name === 'Second')!;

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
    expect(await summaryVisible(page), 'wizard walk ends on the summary').toBeTruthy();
    await submitSummary(page);
    for (let i = 0; i < 20; i++) {
      const m2 = await modelOf(request, second.id);
      if (m2.game.phase === 'drafting' || m2.waitingFor === undefined) {
        break;
      }
      await sendPlayerInput(request, second.id, roadAnswer(m2.waitingFor) as never);
    }
    await page.waitForSelector('.con-start--ceremony', {timeout: 60_000});
    const startRoot = page.locator('.con-start');
    for (let i = 0; i < 25 && await startRoot.count() > 0; i++) {
      await press(page, 'Enter', 1300);
    }
    expect(await startRoot.count(), 'start workspace released').toBe(0);
    await passIntoDrafting(page, request, first.id, second.id);

    // Open the workspace via the mandatory plate.
    await expect.poll(async () => {
      const plate = await page.locator('.con-mandatory').count();
      if (plate === 0) {
        await press(page, 'Escape', 500);
      }
      return plate;
    }, {timeout: 90_000}).toBeGreaterThan(0);
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-draftws', {timeout: 45_000});
    await page.waitForTimeout(4200);

    // Three interactive picks (P2 answers over the API); the 4th card
    // auto-passes at the research transition — the ARRIVAL under test.
    console.log('[probe] pick 1');
    await pickOnUi(page, request, first.id);
    await secondPicksFirstCard(request, second.id);
    await page.waitForTimeout(2500);
    console.log('[probe] pick 2');
    await pickOnUi(page, request, first.id);
    await secondPicksFirstCard(request, second.id);
    await page.waitForTimeout(2500);
    console.log('[probe] pick 3 (last interactive)');
    await pickOnUi(page, request, first.id);
    console.log('[probe] p2 last pick — the transition fires now');
    await secondPicksFirstCard(request, second.id);

    // The rise scene: burst-shoot the arrival + lift-off + flights.
    for (let i = 0; i < 14; i++) {
      await shoot(page, `rise-${String(i).padStart(2, '0')}`);
      await page.waitForTimeout(260);
    }
    await expect.poll(async () => page.evaluate(() => {
      const el = document.querySelector('.con-draftws__stage--buy');
      return el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    }), {timeout: 45_000}).toBeTruthy();
    await page.waitForTimeout(2000);
    await shoot(page, 'buy-settled');

    // ZERO-BUY: RT with no picks («Пропустить»). The ghost probe is ARMED
    // BEFORE the press (tests.md: an order claim cannot be sampled three
    // round-trips late): while the committed exit plays (`__row--departing`
    // present), NO slot may still carry the focus/picked chrome — the
    // reported «контур фокуса» stood exactly there, because the TV
    // profile's couch-ring rule out-specified the departing suppression.
    await page.evaluate(() => {
      const st = {witnessed: 0, ringFrames: 0, timer: 0};
      const scan = () => {
        const row = document.querySelector('.con-draftws__stage--buy .con-draftws__row--departing');
        if (row === null) {
          return;
        }
        st.witnessed++;
        if (row.querySelector('.con-cards__slot--focused, .con-cards__slot--picked') !== null) {
          st.ringFrames++;
        }
      };
      st.timer = window.setInterval(scan, 32) as unknown as number;
      const mo = new MutationObserver(scan);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      (window as unknown as {__ghost?: typeof st, __ghostMo?: MutationObserver}).__ghost = st;
      (window as unknown as {__ghostMo?: MutationObserver}).__ghostMo = mo;
    });
    console.log('[probe] zero-buy commit');
    let committed = false;
    for (const deadline = Date.now() + 60_000; !committed && Date.now() < deadline;) {
      await press(page, 'Period', 900);
      const m = await modelOf(request, first.id);
      committed = m.thisPlayer?.needsToResearch === false || m.game.phase === 'action';
    }
    expect(committed, 'RT committed the zero-buy').toBeTruthy();
    // Burst-shoot the exit: cards tumble out; anything left painting a ring
    // in the emptied stage is the reported artifact.
    for (let i = 0; i < 12; i++) {
      await shoot(page, `exit-${String(i).padStart(2, '0')}`);
      if (i === 3 || i === 6 || i === 9) {
        const rings = await ringSweep(page);
        console.log(`[rings @exit-${i}]`, JSON.stringify(rings));
      }
      await page.waitForTimeout(300);
    }
    const late = await ringSweep(page);
    console.log('[rings late]', JSON.stringify(late));
    const ghost = await page.evaluate(() => {
      const w = window as unknown as {__ghost: {witnessed: number, ringFrames: number, timer: number}, __ghostMo?: MutationObserver};
      window.clearInterval(w.__ghost.timer);
      w.__ghostMo?.disconnect();
      return {witnessed: w.__ghost.witnessed, ringFrames: w.__ghost.ringFrames};
    });
    console.log('[ghost probe]', JSON.stringify(ghost));
    // A witness that saw nothing proves nothing — the probe must have caught
    // the departing window itself (it spans ~600ms of exit + the done wait).
    expect(ghost.witnessed, 'the ghost probe observed the departing exit').toBeGreaterThan(3);
    expect(ghost.ringFrames, 'no frame paints focus/picked chrome past the commit boundary').toBe(0);
    await shoot(page, 'released');
  });
});
