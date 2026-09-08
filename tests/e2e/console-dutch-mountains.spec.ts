import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, createGameWithCards, fetchPlayerModel, openCardActions, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * DP08 — DUTCH MOUNTAINS, the vertical smoke: the composer's stage-reward
 * step hands the screen to the REAL Hydronetwork workspace as a selection
 * surface, the pick returns as the step's captured draft, and the ONE
 * ordinary activation batch pays 3 energy and grants the claimed stage's
 * reward through the shared resolver — with the marker NEVER moving and the
 * Hydronetwork never opening a second time for the execution.
 *
 * Route: four tag cards over the API → one ordinary 0→5 advance (the landing
 * deck pick answered over the API) → Dutch Mountains played (position 5
 * satisfies the ≥4 requirement) → the CONSOLE drives the whole action:
 * open composer → the reward step opens the track → walk to stage 3 (+2 M€
 * production — deterministic) → A returns → the CTA activates → server totals.
 *
 * Screenshots → `screenshots/dutch-mountains/`.
 */

const OUT = path.resolve('screenshots', 'dutch-mountains');

const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research'];
const ALL_CARDS = [...TAG_CARDS, 'Dutch Mountains'];

const CFG = soloGameConfig({
  players: [{name: 'DutchProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.53,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Settle every intermediate prompt until the action menu stands. */
async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 22)},
  } as never);
}

/** One ordinary 0→5 advance over the API — the landing deck pick answered. */
async function advanceToFive(request: APIRequestContext, id: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Advance on the Hydronetwork track');
  expect(at, 'the menu offers the Hydronetwork advance').toBeGreaterThanOrEqual(0);
  let model = await sendPlayerInput(request, id, {type: 'or', index: at, response: {type: 'option'}} as never) as Wire;
  expect((model.waitingFor as Wire)?.type).toBe('deltaProject');
  model = await sendPlayerInput(request, id, {type: 'deltaProject', amount: 5} as never) as Wire;
  const draw = model.waitingFor as Wire;
  expect(draw?.type, 'the stage-5 landing deals its keep pick').toBe('card');
  const names = (draw.cards ?? []).slice(0, 2).map((c: Wire) => c.name);
  await sendPlayerInput(request, id, {type: 'card', cards: names} as never);
}

async function serverState(request: APIRequestContext, id: string): Promise<Wire> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const p = model.thisPlayer ?? {};
  return {
    position: p.deltaProject?.position ?? 0,
    usedThisGeneration: p.deltaProject?.usedThisGeneration === true,
    energy: p.energy ?? 0,
    mcProduction: p.megacreditProduction ?? 0,
  };
}

test.describe('Dutch Mountains (DP08) · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('composer step → Hydronetwork reward pick → return → 3 energy → the stage-3 reward, no movement', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.53});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of TAG_CARDS) {
      await playCard(request, id, card);
    }
    await advanceToFive(request, id);
    await playCard(request, id, 'Dutch Mountains');
    await toActionMenu(request, id);

    const before = await serverState(request, id);
    expect(before.position, 'the requirement seat: position 5').toBe(5);
    // The setup advance IS this generation's ordinary move — so the claim
    // below («DP08 does not consume it») is asserted as an unchanged TRUE.
    expect(before.usedThisGeneration, 'the ordinary advance was spent by setup').toBe(true);

    await openConsole(page, id, '');
    await waitForBoardHome(page, 40);

    // ── ДЕЙСТВИЯ КАРТ → the DP08 composer (the only card action in play). ──
    await openCardActions(page);
    const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
    for (let i = 0; i < 4 && await stage.count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(stage, 'the DP08 action focus stage').toHaveCount(1, {timeout: 8000});
    await shoot(page, '01-composer');

    // ── The reward STEP hands the screen to the REAL track. ──
    for (let i = 0; i < 4 && await page.locator('.con-hydro').count() === 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await page.waitForSelector('.con-hydro__layer--rewardpick', {timeout: 10_000});
    // No movement grammar: no route arrow, no commit line — a selection surface.
    expect(await page.locator('.con-hydro__route').count(), 'no route is drawn').toBe(0);
    await shoot(page, '02-reward-pick');

    // ── Walk to stage 3 (+2 M€ production — deterministic) and claim it. ──
    for (let i = 0; i < 6; i++) {
      const focused = await page.evaluate(() =>
        document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
      if (focused === '3') {
        break;
      }
      await press(page, 'ArrowLeft', 700);
    }
    expect(await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? ''),
    'stage 3 is focused').toBe('3');
    await press(page, 'Enter', 1600);

    // ── Back in the SAME composer: the step is filled; nothing was spent. ──
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    await expect(stage, 'the composer came back').toHaveCount(1, {timeout: 8000});
    const mid = await serverState(request, id);
    expect(mid.energy, 'choosing costs nothing').toBe(before.energy);
    expect(mid.mcProduction).toBe(before.mcProduction);
    // The configuration states the claimed stage's EXACT outcome — the shared
    // hydro «Вы получите» block with the honest before → after of stage 3
    // (+2 M€ production off the live counter). Confirming blind is the defect.
    const gains = await page.evaluate(() => {
      const block = document.querySelector('.con-composer__stagegains');
      const line = block?.querySelector('.con-hydro__delta');
      return {
        on: block !== null,
        text: (line?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      };
    });
    expect(gains.on, 'the reward preview block stands in the step row').toBe(true);
    expect(gains.text, 'an honest before → after of the claimed production')
      .toContain(`${before.mcProduction}`);
    expect(gains.text).toContain(`${before.mcProduction + 2}`);
    await shoot(page, '03-configured');

    // ── FINAL ACTIVATION: one batch — 3 energy, the stage-3 reward, no move. ──
    await press(page, 'Enter', 2600);
    await expect.poll(async () => (await serverState(request, id)).mcProduction,
      {timeout: 25_000, message: 'the claimed stage-3 reward lands'}).toBe(before.mcProduction + 2);
    const after = await serverState(request, id);
    expect(after.energy, 'exactly 3 energy paid').toBe(before.energy - 3);
    expect(after.position, 'the marker did not move').toBe(5);
    expect(after.usedThisGeneration, 'the ordinary advance flag is untouched').toBe(before.usedThisGeneration);
    // The Hydronetwork never opens a second time for the execution.
    expect(await page.locator('.con-hydro').count(), 'no second Hydronetwork trip').toBe(0);
    await page.waitForTimeout(2500);
    await shoot(page, '04-after');
  });

  /**
   * VIRON COPIES DUTCH MOUNTAINS — the nested reward pick TAKES THE SCENE.
   *
   * The 2026-09-06 report: from the Viron repeat browser the inner DP08
   * composer's stage-reward pick pushed its hydro frame over the `repeat-pick`
   * frame, and with no `frameSteps: 'scene'` declaration on that row NOBODY
   * yielded — the track (an in-flow flex child of .con-main) mounted BEHIND
   * the absolute browser band: «гидросеть открылась на фоне как второй
   * workspace». The claim here is the scene handoff: while the pick stands,
   * the hydro layer is the ONE thing drawn (both ДЕЙСТВИЯ КАРТ roots hidden),
   * and the resolve returns to the repeat composer with the draft captured.
   * The whole copy then commits through the ordinary Viron batch.
   */
  test('Viron copies DP08: the reward pick takes the scene, the browser waits underneath', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: {
      ...CFG,
      expansions: {...(CFG.expansions as Record<string, boolean>), venus: true},
      customCorporationsList: ['Viron'],
    }, seed: 0.57});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'Viron'});
    for (const card of TAG_CARDS) {
      await playCard(request, id, card);
    }
    await advanceToFive(request, id);
    await playCard(request, id, 'Dutch Mountains');

    // ── Use DP08 once over the API, so Viron has a candidate to copy. ──
    {
      const menu = await toActionMenu(request, id);
      const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Perform an action from a played card');
      expect(at, 'the menu offers the card action').toBeGreaterThanOrEqual(0);
      const model = await sendPlayerInput(request, id, {
        type: 'or', index: at, response: {type: 'card', cards: ['Dutch Mountains']},
      } as never) as Wire;
      expect((model.waitingFor as Wire)?.type, 'DP08 asks its stage claim').toBe('deltaStageReward');
      await sendPlayerInput(request, id, {type: 'deltaStageReward', position: 3} as never);
      await toActionMenu(request, id);
    }
    const before = await serverState(request, id);

    await openConsole(page, id, '');
    await waitForBoardHome(page, 40);

    // ── ДЕЙСТВИЯ КАРТ → walk to VIRON → its repeat slot opens the browser. ──
    await openCardActions(page);
    for (let i = 0; i < 12; i++) {
      const focused = await page.locator('.con-cardactions .con-cardactions__detail-cardwrap').first()
        .getAttribute('data-zoom-slot').catch(() => '');
      if (focused === 'Viron') {
        break;
      }
      await press(page, 'ArrowDown', 350);
    }
    const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
    for (let i = 0; i < 4 && await stage.count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(stage, 'the Viron action focus stage').toHaveCount(1, {timeout: 8000});
    await press(page, 'Enter', 2500); // A on the repeat slot → the pick browser
    await expect(page.locator('.con-cardactions'), 'the repeat browser stands up').toHaveCount(2);
    await press(page, 'Enter', 2200); // A = «Выбрать» DP08 (the only candidate)

    // ── The INNER composer's reward step hands the screen to the track. ──
    for (let i = 0; i < 5 && await page.locator('.con-hydro').count() === 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await page.waitForSelector('.con-hydro__layer--rewardpick', {timeout: 10_000});
    await shoot(page, 'viron-01-reward-pick');

    // ── THE CLAIM: the pick OWNS the scene — nothing paints over the track. ──
    const sceneRead = await page.evaluate(() => {
      const visible = (el: Element | null): boolean => {
        if (el === null) {
          return false;
        }
        const cs = getComputedStyle(el as HTMLElement);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
      };
      return {
        hydroVisible: visible(document.querySelector('.con-hydro')),
        browsersDrawn: Array.from(document.querySelectorAll('.con-cardactions'))
          .filter((el) => visible(el)).length,
      };
    });
    expect(sceneRead.hydroVisible, 'the track is actually drawn').toBe(true);
    expect(sceneRead.browsersDrawn,
      'no ДЕЙСТВИЯ КАРТ surface may paint over the reward pick (the «на фоне» defect)').toBe(0);

    // ── Walk to stage 3 (+2 M€ production — deterministic) and resolve. ──
    for (let i = 0; i < 6; i++) {
      const focused = await page.evaluate(() =>
        document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
      if (focused === '3') {
        break;
      }
      await press(page, 'ArrowLeft', 700);
    }
    await press(page, 'Enter', 1800);
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    // The browser re-shows with the inner composer + the captured draft.
    await expect(page.locator('.con-cardactions'), 'the browser came back').toHaveCount(2);
    await shoot(page, 'viron-02-configured');

    // ── «Выбрать это действие» → back to the source → the FINAL submit. ──
    await press(page, 'Enter', 2200);
    await expect(page.locator('.con-cardactions'), 'the pick resolved back to the source')
      .toHaveCount(1, {timeout: 10_000});
    for (let tries = 0; tries < 4; tries++) {
      await press(page, 'Enter', 1800);
      if (await page.locator('.con-cardactions').count() > 1) {
        // A landed on the repeat slot (re-open) — close and step off it.
        await press(page, 'Escape', 1800);
        await press(page, 'ArrowDown', 500);
        continue;
      }
      break;
    }
    await expect.poll(async () => (await serverState(request, id)).mcProduction,
      {timeout: 25_000, message: 'the copied stage-3 reward lands'}).toBe(before.mcProduction + 2);
    const after = await serverState(request, id);
    expect(after.energy, 'the copy paid its own 3 energy').toBe(before.energy - 3);
    expect(after.position, 'the marker did not move').toBe(5);
    await shoot(page, 'viron-03-after');
  });
});
