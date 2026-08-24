/*
 * CONSOLE FINAL SCORING — the shared e2e harness of the endgame journey.
 *
 * A REAL finished game (never a fixture): testMode hands every player 500 of
 * everything, so the seats can terraform Mars over the API in a few dozen
 * `player/input` round trips — the same endpoint, the same rules, the same
 * validation as the live client.
 *
 * ⚠ THE ONE LAW OF THIS HARNESS (cost a day): once the page is open, the
 * VIEWED seat's prompts are answered THROUGH THE PAGE only. `WaitingFor`
 * skips GO/REFRESH while the viewer holds a required prompt, so an API answer
 * behind a live client freezes it — a state two real clients cannot produce.
 * Drive everyone to the viewer's final-greenery question over the API, answer
 * THAT through the page (`finishFinaleThroughPage`), finish the others over
 * the API, and the promptless page hears the END through its own poll.
 *
 * ⚠ Headless Chromium starves rAF on a quiet screen — every wait here pumps
 * a tiny screenshot (a real BeginFrame), or the GSAP ceremony never advances.
 */
import * as fs from 'fs';
import {expect, Page, APIRequestContext} from '@playwright/test';
import {openConsole, soloGameConfig, CORP_WITH_FIRST_ACTION} from './consoleStart';

export type WirePrompt = {
  type: string,
  title?: unknown,
  min?: number,
  amount?: number,
  options?: Array<WirePrompt>,
  cards?: Array<{name: string, calculatedCost?: number}>,
  spaces?: Array<string>,
  coloniesModel?: Array<{name: string}>,
  disabledColonies?: Array<{name: string, reason?: unknown}>,
  count?: number,
  include?: Array<string>,
  finalGreeneryPrompt?: unknown,
};
export type WireModel = {
  waitingFor?: WirePrompt & {finalGreeneryPrompt?: unknown},
  game: {phase: string, temperature: number, oxygenLevel: number, oceans: number},
  thisPlayer: {victoryPointsBreakdown?: {total: number}},
  players: Array<{color: string, name: string, victoryPointsBreakdown?: {total: number}}>,
};

export const NO_PAYMENT: Readonly<Record<string, number>> = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

export function titleOf(prompt: WirePrompt | undefined): string {
  if (prompt === undefined) {
    return '';
  }
  return typeof prompt.title === 'string' ?
    prompt.title :
    String((prompt.title as {message?: string} | undefined)?.message ?? '');
}

export async function getModel(request: APIRequestContext, id: string): Promise<WireModel> {
  const res = await request.get(`/api/player?id=${id}`);
  expect(res.ok(), `GET api/player: ${res.status()}`).toBeTruthy();
  return res.json();
}

export async function postInput(request: APIRequestContext, id: string, response: Record<string, unknown>): Promise<WireModel> {
  const res = await request.post(`/player/input?id=${id}`, {data: response});
  expect(res.ok(), `player/input rejected ${JSON.stringify(response)}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** A structural answer for any nested branch — the driver's own recursion,
 *  specialized for this journey (a branch is answered by its TYPE, never by
 *  guessing that everything nested is a bare option). */
export function genericAnswer(prompt: WirePrompt, pickCards?: ReadonlyArray<string>): Record<string, unknown> {
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
  case 'colony': {
    // «Выберите колонию» arrives NESTED (a played card's effect, a standard
    // project's target step) and the journey used to die on it — the harness
    // had no answer, so the whole endgame walk failed before it began,
    // whenever the random game happened to deal a colony builder.
    // The server REFUSES a disabled colony, so answering with one would stall
    // the journey on a prompt that never moves.
    const blocked = new Set((prompt.disabledColonies ?? []).map((d) => d.name));
    const open = (prompt.coloniesModel ?? []).map((c) => c.name).filter((n) => !blocked.has(n));
    expect(open.length, `«${titleOf(prompt)}» offered no colony that is not disabled`).toBeGreaterThan(0);
    return {type: 'colony', colonyName: open[0]};
  }
  case 'and':
    return {type: 'and', responses: (prompt.options ?? []).map((o) => genericAnswer(o))};
  case 'resources': {
    // «Выберите N стандартных ресурсов» — the server validates only «non-negative and
    // the sum is exactly `count`», so putting the whole allowance on one
    // unit is the honest structural answer.
    const units = {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
    return {type: 'resources', units: {...units, megacredits: prompt.count ?? 0}};
  }
  case 'resource':
    return {type: 'resource', resource: (prompt.include ?? ['megacredits'])[0]};
  case 'or':
    return {type: 'or', index: 0, response: genericAnswer((prompt.options ?? [])[0])};
  default:
    // ⚠️ THIS IS A WORKLIST, and it fires for a reason that is not the
    // harness's fault: WHICH prompt kinds the journey meets depends on the
    // random deal, so a kind nobody has seen yet surfaces months later as
    // «the endgame walk died before it began». `colony` cost one round of
    // this, `resources` the next. Name what IS answerable so the next gap
    // is a one-line addition rather than an investigation.
    expect(false, `no generic answer for a nested «${prompt.type}» (${titleOf(prompt)}) — ` +
      'answerable kinds: option, space, card, payment, projectCard, amount, colony, ' +
      'resources, resource, and, or').toBeTruthy();
    return {type: 'option'};
  }
}

/** The terraformer strategy for ONE live prompt (undefined = nothing owed). */
export function terraformAnswer(m: WireModel): Record<string, unknown> | undefined {
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
    if (pass >= 0) {
      return answerAt(pass);
    }
    // No pass branch: a corp's owed side question with no way around it
    // (e.g. «Pay 2 M€ to draw a card | Do not buy a card»). The DECLINING
    // branch is conventionally last — take it and keep terraforming.
    expect(options.length, 'an empty OR cannot be answered').toBeGreaterThan(0);
    return answerAt(options.length - 1);
  }
  default:
    return genericAnswer(wf);
  }
}

/**
 * Drive every seat with the terraformer until `stop` says so.
 * Returns the last model of the FIRST seat.
 */
export async function drive(
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

export async function createTable(
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

export const terraformed = (m: WireModel) =>
  m.game.temperature >= 8 && m.game.oxygenLevel >= 14 && m.game.oceans >= 9;

/** A tiny screenshot IS a BeginFrame — the rAF pump for headless Chromium. */
export async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

export async function waitWithFrames(page: Page, predicate: () => Promise<boolean>, maxMs: number, what: string): Promise<void> {
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

export async function shoot(page: Page, dir: string, name: string): Promise<void> {
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: `${dir}/${name}.png`});
}

/**
 * The VIEWED seat answers its own final-greenery question THROUGH THE PAGE
 * (take pending reveals → open past the announce → walk to «Завершить свою
 * партию» → arm → confirm) — the couch player's own two presses.
 */
export async function finishFinaleThroughPage(page: Page): Promise<void> {
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

/**
 * Bring a fresh table all the way to Phase.END with the FIRST seat viewed on
 * the page: terraform over the API, answer the viewer's finale through the
 * page, finish the rest over the API, then wait out pending reveals until the
 * endgame workspace stands.
 */
export async function journeyToEndgame(
  page: Page,
  request: APIRequestContext,
  ids: ReadonlyArray<string>,
): Promise<void> {
  await drive(request, ids, terraformed);
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
}
