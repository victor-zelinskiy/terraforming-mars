import {expect, test} from './consoleTest';
import {openConsole, press, pressUntilVisible, reloadConsole, waitStepDealSettled} from './consoleStart';
import {campaignBase, campaignModelAs, createCampaign, devCommit, launchMission, seedIdentity} from './campaignFixtures';
import {NO_PAYMENT, titleOf} from './consoleEndgameHarness';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE FINALE'S START (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §7–§8): the START-window tenders
 * execute from the start workspace's «НАСЛЕДИЕ» stage; the tenders left unexecuted are bought back by the
 * deployment's «КОМПЕНСАЦИЯ» press. A real three-mission tenders campaign fast-forwarded to its finale, Alice holding
 * four tenders granted outright by the dev fixture:
 *  · R3 opens the stage with a TENDERS zone (four certificates); the d-pad crosses the cards into it;
 *  · «Открытый конкурс» executes in ONE press: the prelude deal grows by two, the stage stands, the corporation pick
 *    made before survives the redeal;
 *  · «Пересмотр прологов» opens a KEEP step over the live deal; A keeps one, RT redeals the rest — the kept one stays;
 *  · «Реструктуризация» deals two candidates and opens its step; A picks a candidate and the lineage corporation it
 *    replaces; RT rewrites the lineage (the self model names it);
 *  · B returns to the page, the pick intact; the selection completes; the ceremony pre-lays the «КОМПЕНСАЦИЯ» plate
 *    for the one tender left («Субсидия»), its press pays 3 M€ and the holding reads «выкуплен».
 */

type WirePrompt = {type: string, title: string | {message: string}, options?: Array<WirePrompt>, cards?: Array<{name: string}>, min?: number, max?: number, tenders?: Array<{instance: string, id: string, status: string}>};
/** The wire spells the viewer's money `megacredits` (`ServerModel`) — a camel-cased read is `undefined`, and `undefined >= NaN` is no witness. */
type WireModel = {waitingFor?: WirePrompt, thisPlayer: {megacredits: number}, campaignTenders?: Array<{id: string, status: string}>, campaignLineage?: Array<string>, game: {phase: string}};

const EXPANSIONS = {
  corpera: true, promo: false, venus: false, colonies: false, prelude: true,
  prelude2: false, turmoil: false, community: false, ares: false, moon: false,
  pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
};

async function model(request: Parameters<typeof createCampaign>[0], id: string): Promise<WireModel> {
  const res = await request.get(`${campaignBase()}/api/player?id=${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** The cards of ONE selection step, found by its title (the server's `SELECT_*_TITLE` — «Select 2 Prelude cards»). */
function stepCards(m: WireModel, title: RegExp): Array<string> {
  const step = (m.waitingFor?.options ?? []).find((o) => title.test(titleOf(o as never)));
  return (step?.cards ?? []).map((c) => c.name);
}

/** The harness's generic start answer for a seat that is not on the page (a calm corporation, the minimum of the rest). */
async function finishSelectionOverApi(request: Parameters<typeof createCampaign>[0], id: string): Promise<void> {
  const m = await model(request, id);
  const wf = m.waitingFor;
  expect(wf?.type).toBe('initialCards');
  const responses = (wf?.options ?? []).map((step) => {
    const offered = (step.cards ?? []).map((c) => c.name);
    if (titleOf(step as never).startsWith('Select corporation')) {
      return {type: 'card', cards: [offered[0]]};
    }
    return {type: 'card', cards: offered.slice(0, step.min ?? 0)};
  });
  const res = await request.post(`${campaignBase()}/player/input?id=${id}`, {data: {type: 'initialCards', responses}});
  expect(res.ok(), await res.text()).toBeTruthy();
  void NO_PAYMENT;
}

test.describe('campaign «Тендеры» — the finale\'s start', () => {
  test('the legacy stage executes the start tenders; the compensation buys the rest back', async ({page, request}) => {
    test.setTimeout(420_000);
    // NOT test mode: it deals every seat EIGHT corporations and the finale's small deck (base + corpera + prelude, minus
    // the two lineages) is then empty by the time «Реструктуризация» asks for two — «No corporation is left to deal».
    const {id} = await createCampaign(request, {testMode: false, expansions: EXPANSIONS}, {rewardMode: 'tenders', missionCount: 3});
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      lineages: {0: ['Ecoline'], 1: ['Helion']},
      tenders: {0: ['openCall', 'preludeReview', 'restructuring', 'researchSubsidy']},
    });
    await launchMission(request, id);
    // Mission 2's grant is stated too: a fixture with NO `tenders` opens the real bidding and resolves it by the bot's
    // order — seat 0 would win a fifth lot, and the stage below counts exactly four.
    await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline', 'Mining Guild'], 1: ['Helion', 'Saturn Systems']}, tenders: {1: ['gamble']}});
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId).toBeTruthy();
    const brunoId = (await campaignModelAs(request, id, 'Bruno')).missions[2]?.yourPlayerId;
    expect(brunoId).toBeTruthy();

    await openConsole(page, aliceId!);
    await page.waitForSelector('.con-start__frame', {timeout: 90_000});
    await waitStepDealSettled(page);
    // The three-mission finale drafts its third corporation — pick one BEFORE the tenders (the redeal must keep it).
    // act → verify → retry: the opening's own gates (the deal's last beat, the shelf's arrival) may still absorb a press.
    const pickLanded = await pressUntilVisible(page, 'Enter', '.con-cards__slot--picked', {tries: 8, settleMs: 900});
    if (!pickLanded) {
      const diag = await page.evaluate(() => {
        const w = window as unknown as {__conInputEcho?: unknown, __conReady?: () => unknown};
        return JSON.stringify({
          echo: w.__conInputEcho, ready: w.__conReady?.(),
          bar: document.querySelector('.con-cmdbar')?.textContent, focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot'),
        });
      });
      expect(pickLanded, `the corporation pick landed — ${diag}`).toBe(true);
    }
    await expect(page.locator('.con-cards__slot--picked')).toHaveCount(1);

    // ── R3 → the stage: corporations · the tenders zone with four certificates. ──
    await press(page, 'KeyV', 400);
    await page.waitForSelector('.con-legview--live', {timeout: 12_000});
    await expect(page.locator('[data-legview-tenders] [data-legview-tender]')).toHaveCount(4);
    await expect(page.locator('[data-legview-tender][data-legview-tender-status="held"]')).toHaveCount(4);
    const cardSeats = await page.locator('[data-legview-slot]').count();
    for (let i = 0; i < cardSeats; i++) {
      await press(page, 'ArrowRight', 160);
    }
    await expect(page.locator('.con-legview__slot--focused[data-legview-tender-kind="openCall"]')).toHaveCount(1);
    await expect.poll(() => page.locator('.con-cmdbar').innerText(), {timeout: 5_000}).toMatch(/исполнить/i);

    // ── «Открытый конкурс»: one press, the prelude deal grows by two; the stage stands; the pick survives. ──
    // The deal's size is the config's (the campaign's own `startingPreludes`, never a number remembered here): the
    // tender adds exactly TWO to whatever was dealt.
    const dealt = stepCards(await model(request, aliceId!), /prelude/i).length;
    expect(dealt, 'a prelude deal stands').toBeGreaterThanOrEqual(2);
    await press(page, 'Enter', 900);
    await expect.poll(async () => stepCards(await model(request, aliceId!), /prelude/i).length, {timeout: 10_000}).toBe(dealt + 2);
    await expect(page.locator('[data-legview-tender-kind="openCall"]')).toHaveAttribute('data-legview-tender-status', 'executed');
    await expect(page.locator('.con-legview--live')).toBeVisible();

    // ── «Пересмотр прологов»: the KEEP step over the six; keep the first, RT redeals the rest. ──
    await press(page, 'ArrowRight', 200);
    await expect(page.locator('.con-legview__slot--focused[data-legview-tender-kind="preludeReview"]')).toHaveCount(1);
    await press(page, 'Enter', 500);
    await expect(page.locator('[data-tender-step][data-tender-step-kind="keep"]')).toHaveCount(1);
    await expect(page.locator('[data-tender-step-card]')).toHaveCount(dealt + 2);
    const kept = await page.locator('[data-tender-step-card]').first().getAttribute('data-tender-step-card');
    expect(kept).toBeTruthy();
    await expect.poll(() => page.locator('.con-cmdbar').innerText(), {timeout: 5_000}).toMatch(/пересдать остальные/i);
    await press(page, 'Enter', 400);
    await expect(page.locator(`[data-tender-step-card="${kept}"]`)).toHaveAttribute('data-tender-step-picked', 'yes');
    await press(page, 'Period', 900);
    await expect.poll(async () => {
      const deal = stepCards(await model(request, aliceId!), /prelude/i);
      return deal.length === dealt + 2 && deal.includes(kept!) ? 'kept' : `deal=${deal.length}`;
    }, {timeout: 10_000}).toBe('kept');
    await expect(page.locator('[data-tender-step]')).toHaveCount(0);
    await expect(page.locator('[data-legview-tender-kind="preludeReview"]')).toHaveAttribute('data-legview-tender-status', 'executed');

    // ── «Реструктуризация»: A deals two candidates, the step opens by itself; take the first, replace Ecoline; RT. ──
    await press(page, 'ArrowRight', 200);
    await expect(page.locator('.con-legview__slot--focused[data-legview-tender-kind="restructuring"]')).toHaveCount(1);
    await press(page, 'Enter', 900);
    await expect(page.locator('[data-tender-step][data-tender-step-kind="restructure"]')).toHaveCount(1, {timeout: 12_000});
    const offer = page.locator('[data-tender-step-zone="offer"] [data-tender-step-card]');
    await expect(offer).toHaveCount(2);
    const take = await offer.first().getAttribute('data-tender-step-card');
    await press(page, 'Enter', 300);
    await expect(offer.first()).toHaveAttribute('data-tender-step-picked', 'yes');
    await press(page, 'ArrowRight', 150);
    await press(page, 'ArrowRight', 150);
    await expect(page.locator('[data-tender-step-zone="lineage"] .con-legview__slot--focused')).toHaveCount(1);
    await press(page, 'Enter', 300);
    await expect(page.locator('[data-tender-step-zone="lineage"] [data-tender-step-card="Ecoline"]')).toHaveAttribute('data-tender-step-picked', 'yes');
    await press(page, 'Period', 900);
    await expect.poll(async () => (await model(request, aliceId!)).campaignLineage?.[0], {timeout: 10_000}).toBe(take);
    await expect(page.locator('[data-legview-tender-kind="restructuring"]')).toHaveAttribute('data-legview-tender-status', 'executed');
    // The stage's corporations zone reads the rewritten lineage.
    await expect(page.locator(`[data-legview-slot="${take}"]`)).toHaveCount(1);

    // ── B: one level back — the page and its corporation pick are as left. ──
    await press(page, 'Escape', 400);
    await page.waitForFunction(() => document.querySelector('.con-legview--live') === null, undefined, {timeout: 12_000});
    await expect(page.locator('.con-cards__slot--picked')).toHaveCount(1);

    // ── The selection completes (both seats over the API — the subject here is the deployment), the page lands in the
    // ceremony: the «КОМПЕНСАЦИЯ» plate stands PRE-LAID for the one tender left, with its price. ──
    await finishSelectionOverApi(request, brunoId!);
    await finishSelectionOverApi(request, aliceId!);
    // Alice's OWN selection was answered over the API while her page still showed it: the research phase moves no
    // `gameAge`, so the poll's «changed» cursor (`ApiWaitingFor`) never flags the swapped prompt and the open page
    // would stand on the selection — the reconnect is the honest road to the deployment (a player coming back).
    const serverAfter = await model(request, aliceId!);
    await reloadConsole(page);
    await page.waitForSelector('.con-start__frame', {timeout: 90_000});
    try {
      await page.waitForSelector('[data-tender-compensation]', {timeout: 60_000});
    } catch (e) {
      const ready = await page.evaluate(() => {
        const w = window as unknown as {__conReady?: () => unknown};
        return JSON.stringify(w.__conReady?.());
      }).catch(() => 'no readiness');
      const serverNow = await model(request, aliceId!);
      const sideOf = (m: WireModel) => `${m.waitingFor?.type} / ${titleOf(m.waitingFor as never)} / phase=${m.game.phase}`;
      throw new Error([`no compensation plate: ${String(e).split(String.fromCharCode(10))[0]}`,
        `server right after the answers: ${sideOf(serverAfter)}`,
        `server now: ${sideOf(serverNow)} tenders=${JSON.stringify(serverNow.campaignTenders)}`,
        `page: ${ready}`].join(' | '));
    }
    await expect(page.locator('[data-tender-compensation-sub]')).toContainText('1 × 3');
    await expect(page.locator('[data-tender-compensation-sub]')).toContainText(/Субсидия/i);
    // The deployment is a chain of presses (the base corporation, the merges, the payment…) — walk it with A until the
    // compensation has been paid: the holding reads «выкуплен» and the plate has left. The money is read before EVERY
    // press, so the press that cashed the tender is judged on its own: exactly 3 M€ for the one unexecuted tender.
    let mcBeforePress = (await model(request, aliceId!)).thisPlayer.megacredits;
    for (let i = 0; i < 14; i++) {
      const now = await model(request, aliceId!);
      if ((now.campaignTenders ?? []).some((t) => t.id === 'researchSubsidy' && t.status === 'cashed')) {
        break;
      }
      mcBeforePress = now.thisPlayer.megacredits;
      await press(page, 'Enter', 1100);
    }
    await expect.poll(async () => ((await model(request, aliceId!)).campaignTenders ?? []).find((t) => t.id === 'researchSubsidy')?.status, {timeout: 15_000}).toBe('cashed');
    await expect.poll(() => page.locator('[data-tender-compensation]').count(), {timeout: 10_000}).toBe(0);
    const after = await model(request, aliceId!);
    expect(after.thisPlayer.megacredits - mcBeforePress, 'the Committee paid exactly 3 M€ on the compensation press').toBe(3);
    expect((after.campaignTenders ?? []).filter((t) => t.status === 'executed').map((t) => t.id).sort()).toEqual(['openCall', 'preludeReview', 'restructuring']);
  });
  test('the creator\'s reward dial: «Награды за миссии» heads the rules deck — ◄ ► and A flip titles ↔ tenders, the launch panel names the choice', async ({page}) => {
    test.setTimeout(180_000);
    await seedIdentity(page, 'Alice');
    await page.addInitScript((st) => {
      if (window.localStorage.getItem('tm_last_game_settings') === null) {
        window.localStorage.setItem('tm_last_game_settings', JSON.stringify(st));
      }
    }, {sessionMode: 'campaign', gameMode: 'multiplayer', players: [{name: 'Alice', color: 'blue'}, {name: 'Bruno', color: 'red'}]});
    await page.goto(`${campaignBase()}/?x=1&consoleProfile=tv`);
    await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
    for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
      await press(page, 'ArrowDown', 120);
    }
    await press(page, 'Enter', 300);
    await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
    await press(page, 'Enter', 600);
    await page.waitForSelector('.cm-crew', {timeout: 30_000});
    for (let i = 0; i < 6 && await page.locator('[data-rule-sub="rewardMode"]').count() === 0; i++) {
      await press(page, 'KeyE', 400);
    }
    const dial = page.locator('[data-rule-sub="rewardMode"]');
    await expect(dial).toHaveCount(1, {timeout: 15_000});
    await expect(dial, 'the reward mode HEADS the deck — the cursor lands on it first').toHaveClass(/cm-row--cursor/);
    const value = dial.locator('[data-reward-mode-value]');
    await expect(value).toHaveText(/Титулы/i);
    await press(page, 'ArrowRight', 250);
    await expect(value).toHaveText(/Тендеры/i);
    await expect(dial).toHaveAttribute('data-reward-mode', 'tenders');
    await press(page, 'ArrowRight', 250);
    await expect(value, '◄ ► clamp').toHaveText(/Тендеры/i);
    await press(page, 'Enter', 250);
    await expect(value, 'A cycles').toHaveText(/Титулы/i);
    await press(page, 'Enter', 250);
    await expect(value).toHaveText(/Тендеры/i);
    // The launch panel's route line names the reward beside the length.
    await expect(page.locator('.cm-launch__map-name')).toContainText(/Тендеры/i);
  });
});
