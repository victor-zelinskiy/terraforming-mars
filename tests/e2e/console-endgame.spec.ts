/*
 * CONSOLE FINAL SCORING — the post-game workspace, end to end.
 *
 * A REAL finished game (never a fixture): testMode hands every player 500 of
 * everything, so two seats can terraform Mars over the API in a few dozen
 * `player/input` round trips — the same endpoint, the same rules, the same
 * validation as the live client. The spec then watches the console shell:
 *
 *  · the natural end plays the CEREMONY (the page saw the live game);
 *  · X skips it ATOMICALLY (final totals, ranked rows, winner, actions);
 *  · a RELOAD into the ended game lands SETTLED — no uninvited replay;
 *  · «Обзор партии» opens the desktop results overlay and B returns;
 *  · the gameplay HUD is gone (status strip, hand dock) while the bottom
 *    command bar stays live and names the workspace.
 *
 * ⚠ Headless Chromium starves rAF on a quiet screen — every wait here pumps
 * a tiny screenshot (a real BeginFrame), or the GSAP ceremony never advances.
 */
import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {soloGameConfig, openConsole, CORP_WITH_FIRST_ACTION} from './consoleStart';

const SHOT_DIR = 'screenshots/console-endgame';

type WirePrompt = {
  type: string,
  title?: unknown,
  min?: number,
  amount?: number,
  options?: Array<WirePrompt>,
  cards?: Array<{name: string, calculatedCost?: number}>,
  spaces?: Array<string>,
  finalGreeneryPrompt?: unknown,
};
type WireModel = {
  waitingFor?: WirePrompt & {finalGreeneryPrompt?: unknown},
  game: {phase: string, temperature: number, oxygenLevel: number, oceans: number},
  thisPlayer: {victoryPointsBreakdown?: {total: number}},
  players: Array<{color: string, name: string, victoryPointsBreakdown?: {total: number}}>,
};

const NO_PAYMENT: Readonly<Record<string, number>> = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

function titleOf(prompt: WirePrompt | undefined): string {
  if (prompt === undefined) {
    return '';
  }
  return typeof prompt.title === 'string' ?
    prompt.title :
    String((prompt.title as {message?: string} | undefined)?.message ?? '');
}

async function getModel(request: APIRequestContext, id: string): Promise<WireModel> {
  const res = await request.get(`/api/player?id=${id}`);
  expect(res.ok(), `GET api/player: ${res.status()}`).toBeTruthy();
  return res.json();
}

async function postInput(request: APIRequestContext, id: string, response: Record<string, unknown>): Promise<WireModel> {
  const res = await request.post(`/player/input?id=${id}`, {data: response});
  expect(res.ok(), `player/input rejected ${JSON.stringify(response)}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** A structural answer for any nested branch — the driver's own recursion,
 *  specialized for this journey (a branch is answered by its TYPE, never by
 *  guessing that everything nested is a bare option). */
function genericAnswer(prompt: WirePrompt, pickCards?: ReadonlyArray<string>): Record<string, unknown> {
  switch (prompt.type) {
  case 'option':
    return {type: 'option'};
  case 'space':
    return {type: 'space', spaceId: (prompt.spaces ?? [])[0]};
  case 'card': {
    const offered = (prompt.cards ?? []).map((c) => c.name);
    const wanted = (pickCards ?? []).filter((c) => offered.includes(c));
    const take = wanted.length > 0 ? wanted : offered.slice(0, prompt.min ?? 0);
    return {type: 'card', cards: take};
  }
  case 'payment':
    return {type: 'payment', payment: {...NO_PAYMENT, megacredits: prompt.amount ?? 0}};
  case 'projectCard': {
    // A FORCED play (a first action's «play a card») — the cheapest one.
    const cheapest = [...(prompt.cards ?? [])].sort((a, b) => (a.calculatedCost ?? 0) - (b.calculatedCost ?? 0))[0];
    return {type: 'projectCard', card: cheapest?.name, payment: {...NO_PAYMENT, megacredits: cheapest?.calculatedCost ?? 0}};
  }
  case 'amount':
    return {type: 'amount', amount: prompt.min ?? 0};
  case 'and':
    return {type: 'and', responses: (prompt.options ?? []).map((o) => genericAnswer(o))};
  case 'or':
    return {type: 'or', index: 0, response: genericAnswer((prompt.options ?? [])[0])};
  default:
    expect(false, `no generic answer for a nested «${prompt.type}» (${titleOf(prompt)})`).toBeTruthy();
    return {type: 'option'};
  }
}

/** The terraformer strategy for ONE live prompt (undefined = nothing owed). */
function terraformAnswer(m: WireModel): Record<string, unknown> | undefined {
  const wf = m.waitingFor;
  if (wf === undefined) {
    return undefined;
  }
  switch (wf.type) {
  case 'initialCards':
    return {
      type: 'initialCards',
      responses: (wf.options ?? []).map((step) => {
        const offered = (step.cards ?? []).map((c) => c.name);
        if (titleOf(step).startsWith('Select corporation')) {
          const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
          return {type: 'card', cards: [calm ?? offered[0]]};
        }
        return {type: 'card', cards: offered.slice(0, step.min ?? 0)};
      }),
    };
  case 'or': {
    const options = wf.options ?? [];
    const answerAt = (index: number, pickCards?: ReadonlyArray<string>) =>
      ({type: 'or', index, response: genericAnswer(options[index], pickCards)});
    // The FINAL GREENERY question ends the seat: the DONE branch is last.
    if (wf.finalGreeneryPrompt !== undefined) {
      return answerAt(options.length - 1);
    }
    const findByTitle = (re: RegExp) => options.findIndex((o) => re.test(titleOf(o)));
    // A corporation's owed first action gates the full menu — take it.
    const firstAction = findByTitle(/^Take first action/i);
    if (firstAction >= 0) {
      return answerAt(firstAction);
    }
    // Availability is server-authoritative: an option is answered because it
    // is PRESENT; the parameter checks only stop us re-doing a finished axis.
    if (m.game.temperature < 8) {
      const heat = findByTitle(/heat into temperature/i);
      if (heat >= 0) {
        return answerAt(heat);
      }
    }
    if (m.game.oxygenLevel < 14) {
      const plants = findByTitle(/plants into greenery/i);
      if (plants >= 0) {
        return answerAt(plants);
      }
    }
    if (m.game.oceans < 9) {
      // «Standard projects» is a PROJECT-CARD prompt (the fork's console flow
      // serves it as one) — Aquifer is bought with the card+payment shape.
      const stdIdx = options.findIndex((o) =>
        o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === 'Aquifer'));
      if (stdIdx >= 0) {
        const aquifer = (options[stdIdx].cards ?? []).find((c) => c.name === 'Aquifer');
        return {
          type: 'or', index: stdIdx,
          response: {
            type: 'projectCard', card: 'Aquifer',
            payment: {...NO_PAYMENT, megacredits: aquifer?.calculatedCost ?? 18},
          },
        };
      }
    }
    const pass = findByTitle(/^Pass/i);
    expect(pass, `no pass branch in: ${options.map((o) => `${titleOf(o)}[${o.type}]`).join(' | ')}`).toBeGreaterThanOrEqual(0);
    return answerAt(pass);
  }
  default:
    return genericAnswer(wf);
  }
}

/**
 * Drive every seat with the terraformer until `stop` says so.
 * Returns the last model of the FIRST seat.
 */
async function drive(
  request: APIRequestContext,
  ids: ReadonlyArray<string>,
  stop: (m: WireModel) => boolean,
  maxRounds = 500,
): Promise<WireModel> {
  let idle = 0;
  for (let round = 0; round < maxRounds; round++) {
    if (round % 20 === 0) {
      const m0 = await getModel(request, ids[0]);
      console.log(`[drive] round ${round} phase=${m0.game.phase} temp=${m0.game.temperature} oxy=${m0.game.oxygenLevel} oceans=${m0.game.oceans}`);
    }
    let answered = false;
    for (const id of ids) {
      // `player/input` replies with the UPDATED model — a seat plays its whole
      // turn chain in one streak, no re-GET between the steps.
      let m = await getModel(request, id);
      for (let streak = 0; streak < 30; streak++) {
        if (stop(m)) {
          return m;
        }
        const answer = terraformAnswer(m);
        if (answer === undefined) {
          break;
        }
        m = await postInput(request, id, answer);
        answered = true;
      }
    }
    if (!answered && ++idle > 40) {
      const m = await getModel(request, ids[0]);
      expect(false, `the table stalled (phase ${m.game.phase}, waiting ${m.waitingFor?.type ?? 'nobody'})`).toBeTruthy();
    } else if (answered) {
      idle = 0;
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  expect(false, `never reached the stop condition in ${maxRounds} rounds`).toBeTruthy();
  throw new Error('unreachable');
}

async function createTable(
  request: APIRequestContext,
  colors: ReadonlyArray<string>,
  expansions: Record<string, boolean> = {},
): Promise<Array<string>> {
  const config = soloGameConfig({
    players: colors.map((color, i) => ({
      name: i === 0 ? 'Оч-Длинное-Имя-Игрока-' + color : 'Игрок-' + color,
      color, beginner: false, handicap: 0, first: i === 0,
    })),
    // testMode deals 8 corporations PER SEAT — base+corpEra hold only 24, so a
    // four-seat table needs the wider corp pool or two seats are never dealt
    // and the start deadlocks on `every(pickedCorporationCard)`.
    expansions,
  });
  const created = await request.post('/api/creategame', {data: config});
  expect(created.ok(), `creategame: ${created.status()}`).toBeTruthy();
  const body = await created.json();
  return body.players.map((p: {id: string}) => p.id);
}

const terraformed = (m: WireModel) =>
  m.game.temperature >= 8 && m.game.oxygenLevel >= 14 && m.game.oceans >= 9;

/** A tiny screenshot IS a BeginFrame — the rAF pump for headless Chromium. */
async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

async function waitWithFrames(page: Page, predicate: () => Promise<boolean>, maxMs: number, what: string): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await predicate()) {
      return;
    }
    await forceFrame(page);
    await page.waitForTimeout(120);
  }
  expect(false, `timed out waiting for ${what}`).toBeTruthy();
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOT_DIR, {recursive: true});
  await page.screenshot({path: `${SHOT_DIR}/${name}.png`});
}

/**
 * The VIEWED seat answers its own final-greenery question THROUGH THE PAGE
 * (take pending reveals → open past the announce → walk to «Завершить свою
 * партию» → arm → confirm) — the couch player's own two presses.
 */
async function finishFinaleThroughPage(page: Page): Promise<void> {
  await waitWithFrames(page, async () => {
    if ((await page.locator('.con-reveal').count()) > 0) {
      await page.keyboard.press('Enter'); // take the pending drawn cards first
      return false;
    }
    if ((await page.locator('.con-mandatory').count()) > 0) {
      await page.keyboard.press('Enter'); // the announce hands the screen over
      return false;
    }
    return (await page.locator('.con-finale').count()) > 0;
  }, 45_000, 'the final-greenery screen');
  for (let i = 0; i < 4; i++) {
    const onFinish = (await page.locator('.con-finale__action--destructive.con-finale__action--focused').count()) > 0;
    if (onFinish) {
      break;
    }
    await page.keyboard.press('ArrowDown');
    await forceFrame(page);
  }
  await page.keyboard.press('Enter'); // arm
  await forceFrame(page);
  await page.keyboard.press('Enter'); // finish my game
  await waitWithFrames(page, async () => (await page.locator('.con-finale').count()) === 0, 20_000, 'the finale submit');
}

test.describe('console endgame workspace — 2p, full journey', () => {
  test('natural end plays the ceremony; skip is atomic; reload settles; overview round-trips', async ({page, request}) => {
    test.setTimeout(480_000);
    const ids = await createTable(request, ['red', 'blue']);

    // 1 · Terraform Mars over the API (the page is not open yet), then bring
    //     the table to RED's FINAL-GREENERY question and stop.
    //
    //     The one rule of this harness: once the page is open, the VIEWED
    //     seat's prompts are answered THROUGH THE PAGE only. Answering them
    //     over the API behind a live client freezes its mid-prompt guard
    //     (WaitingFor skips GO/REFRESH while the viewer holds a required
    //     prompt) — a state two real clients cannot produce, not a bug.
    await drive(request, ids, terraformed);
    await drive(request, ids, (m) => m.waitingFor?.finalGreeneryPrompt !== undefined && m.game.phase !== 'end');

    // Diagnostics that cost nothing when green: the page's own errors are the
    // first evidence needed whenever «the end never arrives».
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[page-err]', msg.text().slice(0, 300));
      }
    });
    await openConsole(page, ids[0]);
    await expect(page.locator('.con-root')).toBeVisible();
    expect(await page.locator('.con-endgame').count()).toBe(0); // still a live game

    // 2 · RED (the viewed seat) finishes THROUGH THE PAGE — the couch
    //     player's own two presses on «Завершить свою партию».
    await finishFinaleThroughPage(page);

    // 3 · BLUE finishes over the API — the promptless page hears the END
    //     through its own poll, exactly like a player watching the table.
    await drive(request, ids, (m) => m.game.phase === 'end');

    // 4 · THE CEREMONY — the workspace enters on its own and the count runs.
    //     (A pending drawn-card reveal is taken with A first, as on the couch.)
    await waitWithFrames(page, async () => {
      if ((await page.locator('.con-reveal').count()) > 0) {
        await page.keyboard.press('Enter');
        return false;
      }
      return (await page.locator('.con-endgame').count()) > 0;
    }, 60_000, 'the endgame workspace (taking pending reveals first)');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--entering, .con-endgame--scoring').count()) > 0,
    15_000, 'the ceremony to start');
    // The gameplay HUD has left; the command bar stays and says why.
    await expect(page.locator('.con-status')).toBeHidden();
    expect(await page.locator('.con-handdock:visible').count()).toBe(0);
    await expect(page.locator('.con-cmdbar')).toContainText(/Финальный подсчёт/i);
    await expect(page.locator('.con-cmdbar')).toContainText(/Пропустить подсчёт/i);
    // All rows on screen at once, in seating order, with empty bars growing.
    expect(await page.locator('.con-eg__row').count()).toBe(2);
    await shoot(page, '2p-ceremony-scoring');

    // Mid-count: no places, no winner plate — the result is still untold.
    expect(await page.locator('.con-eg__place-num').count()).toBe(0);
    expect(await page.locator('.con-eg__wplate').count()).toBe(0);

    // 4 · SKIP (X): one press → the canonical final state, atomically.
    await page.keyboard.press('KeyX');
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 8_000, 'the settled actions');
    await page.keyboard.press('KeyX'); // a second skip must be a no-op
    await forceFrame(page);
    await expect(page.locator('.con-eg__wplate')).toBeVisible();
    expect(await page.locator('.con-eg__place-num').count()).toBe(2);

    // The displayed totals are the SERVER's own breakdown totals.
    const finalModel = await getModel(request, ids[0]);
    const serverTotals = finalModel.players
      .map((p) => p.victoryPointsBreakdown?.total ?? -1)
      .sort((a, b) => b - a);
    const shown = (await page.locator('.con-eg__total-num').allTextContents())
      .map((t) => Number(t.trim()))
      .sort((a, b) => b - a);
    expect(shown).toEqual(serverTotals);
    await shoot(page, '2p-settled');

    // 5 · The action list drives from the pad: focus moves, A opens the
    //     desktop overview, B (fallback minimize) returns to the workspace.
    const focused = () => page.locator('.con-eg__action--focused .con-eg__action-label').first().textContent();
    const first = await focused();
    await page.keyboard.press('ArrowRight');
    await forceFrame(page);
    expect(await focused()).not.toBe(first);
    await page.keyboard.press('ArrowLeft');
    await forceFrame(page);
    expect(await focused()).toBe(first); // back on «Обзор партии»

    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () => (await page.locator('.eg-results').count()) > 0, 15_000, 'the desktop overview');
    await expect(page.locator('.con-endgame')).toBeHidden(); // the workspace yields
    await shoot(page, '2p-overview');
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.eg-results').count()) === 0, 10_000, 'the overview to close');
    await expect(page.locator('.con-endgame')).toBeVisible();
    await expect(page.locator('.con-eg__wplate')).toBeVisible(); // state survived the round trip

    // 6 · RELOAD into the ended game: the settled state, instantly — the
    //     ceremony must NOT replay uninvited.
    await openConsole(page, ids[0]);
    await waitWithFrames(page, async () => (await page.locator('.con-endgame').count()) > 0, 30_000, 'the workspace after reload');
    await forceFrame(page);
    expect(await page.locator('.con-endgame--scoring, .con-endgame--entering').count()).toBe(0);
    await expect(page.locator('.con-eg__actions')).toBeVisible();
    await expect(page.locator('.con-eg__wplate')).toBeVisible();

    // 7 · «Повторить подсчёт» exists and replays the ceremony on demand.
    const labels = await page.locator('.con-eg__action-label').allTextContents();
    expect(labels.join(' | ')).toMatch(/Повторить подсчёт/i);
    expect(labels.join(' | ')).toMatch(/Обзор партии/i);
    expect(labels.join(' | ')).toMatch(/В главное меню/i);
  });
});

test.describe('console endgame workspace — 4K TV, four players', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test('the ceremony reads at couch distance: all rows, micro-reveals, ranking, winner', async ({page, request}) => {
    test.setTimeout(420_000);
    const ids = await createTable(request, ['red', 'blue', 'green', 'yellow'], {promo: true, community: true});
    await drive(request, ids, terraformed);
    // The same choreography as the 2p journey: the VIEWED seat answers its
    // final greenery through the page, the other three finish over the API.
    await drive(request, ids, (m) => m.waitingFor?.finalGreeneryPrompt !== undefined && m.game.phase !== 'end');
    await openConsole(page, ids[0]);
    await finishFinaleThroughPage(page);
    await drive(request, ids, (m) => m.game.phase === 'end');

    await waitWithFrames(page, async () => {
      if ((await page.locator('.con-reveal').count()) > 0) {
        await page.keyboard.press('Enter');
        return false;
      }
      return (await page.locator('.con-endgame').count()) > 0;
    }, 75_000, 'the endgame workspace (taking pending reveals first)');
    expect(await page.locator('.con-eg__row').count()).toBe(4);
    await shoot(page, '4k-ceremony-enter');

    // Watch the count: the TR micro-reveal marks sub-steps in the caption and
    // grows sub-segments for EVERY row at once.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__subseg--on').count()) >= 4,
    30_000, 'the first synchronized reveal');
    await shoot(page, '4k-ceremony-tr');

    // Let a few categories land, then take the mid-count comparison shot.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__val--on').count()) >= 8,
    45_000, 'a few settled categories');
    await shoot(page, '4k-ceremony-mid');

    // The ceremony settles on its own (no skip): ranking → winner → actions.
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 90_000, 'the natural finish');
    await shoot(page, '4k-final');

    // Everything fits: the workspace never scrolls at TV scale.
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('.con-endgame');
      if (el === null) {
        return 'missing';
      }
      return el.scrollHeight > el.clientHeight + 1 ? 'scrolls' : 'fits';
    });
    expect(overflow).toBe('fits');

    // Four rows, four totals, ranked places 1..4 visible.
    expect(await page.locator('.con-eg__place-num').count()).toBe(4);
  });
});
