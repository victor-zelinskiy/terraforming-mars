import {expect, test} from './consoleTest';
import {fillPicks, openConsole, pickedCards, press, pressUntil, waitStepDealSettled} from './consoleStart';
import {campaignBase, campaignModelAs, createCampaign, devCommit, launchMission, seedIdentity} from './campaignFixtures';
import {NO_PAYMENT, titleOf} from './consoleEndgameHarness';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE FINALE'S START (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §16): the PORTFOLIO is the wizard's
 * first step; a tender executes WHERE its effect lands (the reviews in their mode on the deal step, the restructuring
 * on the corporation step); the summary warns before the terminal press; the tenders left unexecuted are bought back
 * by the deployment's BUYOUT. A real three-mission tenders campaign fast-forwarded to its finale, Alice holding
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
  test('the PORTFOLIO step executes the start tenders where their effect lands; the summary warns; the buyout pays exactly 3 M€', async ({page, request}) => {
    test.setTimeout(480_000);
    // NOT test mode: it deals every seat EIGHT corporations and the finale's small deck (base + corpera + prelude, minus
    // the two lineages) is then empty by the time «Реструктуризация» asks for two — «No corporation is left to deal».
    const {id} = await createCampaign(request, {testMode: false, expansions: EXPANSIONS}, {rewardMode: 'tenders', missionCount: 3});
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      lineages: {0: ['Ecoline'], 1: ['Helion']},
      tenders: {0: ['openCall', 'preludeReview', 'restructuring', 'researchSubsidy', 'targetedRequest']},
    });
    await launchMission(request, id);
    // Mission 2's grant is stated too: a fixture with NO `tenders` opens the real bidding and resolves it by the bot's
    // order — seat 0 would win a fifth lot, and the portfolio below counts exactly four.
    await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline', 'Mining Guild'], 1: ['Helion', 'Saturn Systems']}, tenders: {1: ['gamblePreludes']}});
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId).toBeTruthy();
    const brunoId = (await campaignModelAs(request, id, 'Bruno')).missions[2]?.yourPlayerId;
    expect(brunoId).toBeTruthy();

    await openConsole(page, aliceId!);
    await page.waitForSelector('.con-start__frame', {timeout: 90_000});
    await waitStepDealSettled(page);
    const bar = () => page.locator('.con-cmdbar').innerText();
    // The head's whole text carries the journey rail too (every step's name) — a STEP is witnessed by the crumb's
    // SUBJECT segment alone; a MODE's stage word («ПЕРЕСМОТР», «РЕСТРУКТУРИЗАЦИЯ») appears nowhere else in the head.
    const crumb = () => page.locator('.con-wshead').innerText();
    const subject = () => page.locator('.con-wshead__subject').last().innerText();
    const portfolio = page.locator('[data-tender-portfolio]');
    const slot = (kind: string) => page.locator(`[data-tport-slot][data-tport-kind="${kind}"]`);

    // ── THE PORTFOLIO stands FIRST: four certificates, the first focused, its reading in the deal's numbers, the bar its verb. ──
    await expect(portfolio).toBeVisible();
    await expect(page.locator('[data-tport-slot]')).toHaveCount(5);
    // The dock's «ТЕНДЕРЫ» block stands on the lineage's chassis — one row of miniature certificates, never the column
    // of word chips that stretched the whole dock by a row per holding (the owner's frame of 2026-11-09).
    const dockBoxes = await page.evaluate(() => ({
      tenders: document.querySelector('[data-tender-dock]')?.getBoundingClientRect().height,
      lineage: document.querySelector('.con-startdock__legacy:not(.con-startdock__tenders)')?.getBoundingClientRect().height,
      cards: document.querySelectorAll('[data-tender-dock-chip] .con-tender').length,
    }));
    expect(dockBoxes.cards, 'every holding is a miniature certificate').toBe(5);
    expect(dockBoxes.tenders, `the tenders block is no taller than the lineage block ${JSON.stringify(dockBoxes)}`).toBeLessThanOrEqual((dockBoxes.lineage ?? 0) * 1.15);
    await expect.poll(subject, {timeout: 5_000}).toMatch(/тендер/i);
    await expect(slot('openCall')).toHaveAttribute('data-tport-focused', 'yes');
    await expect(slot('openCall')).toHaveAttribute('data-tport-state', 'ready');
    const dealt = stepCards(await model(request, aliceId!), /prelude/i).length;
    expect(dealt, 'a prelude deal stands').toBeGreaterThanOrEqual(2);
    await expect(page.locator('[data-tport-reading]')).toContainText(`${dealt} → ${dealt + 2}`);
    await expect.poll(bar, {timeout: 5_000, message: 'A is the certificate\'s verb'}).toMatch(/исполнить/i);
    // The dock carries the portfolio's home: five chips, all held.
    await expect(page.locator('[data-tender-dock-chip]')).toHaveCount(5);

    // ── «Открытый конкурс»: ONE press — the screen travels to the prelude step, the deal grows by two there, the chip takes its stamp. ──
    await press(page, 'Enter', 900);
    await expect.poll(subject, {timeout: 8_000, message: 'the travel to the prelude step'}).toMatch(/пролог/i);
    await expect.poll(async () => stepCards(await model(request, aliceId!), /prelude/i).length, {timeout: 10_000}).toBe(dealt + 2);
    await waitStepDealSettled(page);
    await expect(page.locator(`[data-step-slot^="prelude|"]`)).toHaveCount(dealt + 2);
    await expect(page.locator('[data-tender-dock-chip][data-tender-dock-status="executed"]')).toHaveCount(1);

    // ── Back to the portfolio (two LT steps — each act → verify → retry: a step's first-visit deal takes a press as its
    //    skip): the certificate reads EXECUTED; the review is next. ──
    expect(await pressUntil(page, 'Comma', async () => /корпорац|слияни/i.test(await subject()), {tries: 4, settleMs: 900}), 'LT to the corporation step').toBe(true);
    await waitStepDealSettled(page);
    expect(await pressUntil(page, 'Comma', async () => await portfolio.isVisible(), {tries: 4, settleMs: 900}), 'LT to the portfolio').toBe(true);
    await expect(slot('openCall')).toHaveAttribute('data-tport-state', 'executed');
    await press(page, 'ArrowRight', 250);
    await expect(slot('preludeReview')).toHaveAttribute('data-tport-focused', 'yes');
    await expect.poll(bar, {timeout: 5_000}).toMatch(/пересмотреть/i);

    // ── «Пересмотр прологов»: the REVIEW mode on the prelude step's own strip — A keeps the focused card, RT redeals the rest. ──
    await press(page, 'Enter', 900);
    await expect.poll(subject, {timeout: 8_000, message: 'the travel to the prelude step'}).toMatch(/пролог/i);
    await expect.poll(crumb, {timeout: 8_000, message: 'the prelude step in its review mode'}).toMatch(/пересмотр/i);
    await expect.poll(bar, {timeout: 5_000}).toMatch(/пересдать остальные/i);
    await press(page, 'Enter', 400);
    await expect(page.locator('[data-tender-keep]')).toHaveCount(1);
    const kept = await page.locator('.con-cards__slot--keep [data-zoom-slot], .con-cards__slot--keep').first().getAttribute('data-zoom-slot');
    expect(kept).toBeTruthy();
    await press(page, 'Period', 900);
    await expect.poll(async () => {
      const deal = stepCards(await model(request, aliceId!), /prelude/i);
      return deal.length === dealt + 2 && deal.includes(kept!) ? 'kept' : `deal=${deal.length}`;
    }, {timeout: 10_000}).toBe('kept');
    await expect.poll(crumb, {timeout: 8_000, message: 'the mode ends — the page is the prelude selection again'}).not.toMatch(/пересмотр/i);
    // The kept card became the step's pick (deselectable like any pick).
    await expect(page.locator(`.con-cards__slot--picked[data-zoom-slot="${kept}"]`)).toHaveCount(1);
    await waitStepDealSettled(page);

    // ── «Целевой запрос» (§18.6): A travels to the PROJECT step in its TAG mode — a row of tags over the strip; A names
    //    the focused tag, RT asks the Committee: three cards with that tag come off the deck INTO the deal. ──
    expect(await pressUntil(page, 'Comma', async () => /корпорац|слияни/i.test(await subject()), {tries: 4, settleMs: 900}), 'LT to the corporation step').toBe(true);
    await waitStepDealSettled(page);
    expect(await pressUntil(page, 'Comma', async () => await portfolio.isVisible(), {tries: 4, settleMs: 900}), 'LT to the portfolio').toBe(true);
    for (let i = 0; i < 4; i++) {
      await press(page, 'ArrowRight', 250);
    }
    await expect(slot('targetedRequest')).toHaveAttribute('data-tport-focused', 'yes');
    await expect.poll(bar, {timeout: 5_000}).toMatch(/назвать метку/i);
    await page.screenshot({path: 'screenshots/tenders/targeted-request-1-portfolio.png'});
    const projectsBefore = stepCards(await model(request, aliceId!), /buy|project/i).length;
    expect(projectsBefore, 'the project deal stands').toBeGreaterThan(0);
    await press(page, 'Enter', 900);
    await expect.poll(subject, {timeout: 8_000, message: 'the travel to the project step'}).toMatch(/проект/i);
    await expect(page.locator('[data-tender-mode="tag"]')).toHaveCount(1, {timeout: 10_000});
    await expect.poll(crumb, {timeout: 5_000}).toMatch(/метк/i);
    const tags = page.locator('[data-tender-mode="tag"] [data-tender-tag]');
    expect(await tags.count(), 'the printed tags of the table').toBeGreaterThanOrEqual(8);
    // Every chip wears the deck's own number (the server's count); the focused first tag has cards to give.
    const counts = await tags.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-tender-tag-count'))));
    expect(counts.every((n) => Number.isFinite(n) && n >= 0), `server-counted tags: ${counts.join(',')}`).toBe(true);
    expect(counts[0], 'the first tag (Building) has cards to give').toBeGreaterThanOrEqual(3);
    await expect.poll(bar, {timeout: 5_000}).toMatch(/выбрать эту метку/i);
    await press(page, 'Enter', 300);
    await expect(page.locator('[data-tender-mode="tag"] [data-tender-mode-picked="yes"]')).toHaveCount(1);
    // The row stands ABOVE the deal (in flow — a wrapped second line once covered the first row of cards), and every
    // dealt card is WHOLE inside the step's body (the strip re-fits under the row and under a dock that grew).
    const dealGeometry = () => page.evaluate(() => {
      const r = (el: Element | null | undefined) => {
        const b = el?.getBoundingClientRect();
        return b === undefined ? undefined : {top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), l: Math.round(b.left), w: Math.round(b.width)};
      };
      const body = document.querySelector('.con-start__body--cards')!.getBoundingClientRect();
      const row = document.querySelector('[data-tender-mode="tag"]')?.getBoundingClientRect();
      const slotEls = Array.from(document.querySelectorAll('[data-step-slot^="projects|"]'));
      const slots = slotEls.map((el) => el.getBoundingClientRect());
      const strip = slotEls[0]?.parentElement ?? null;
      return {bodyTop: body.top, bodyBottom: body.bottom, rowBottom: row?.bottom,
        slotTop: Math.min(...slots.map((r) => r.top)), slotBottom: Math.max(...slots.map((r) => r.bottom)), slots: slots.length,
        // the boxes the fit stands on — named in every message so a red says WHICH box lied
        boxes: {row: r(row === undefined ? undefined : document.querySelector('[data-tender-mode="tag"]')), column: r(strip?.parentElement), strip: r(strip),
          stripClient: strip?.clientHeight, stripScroll: strip?.scrollHeight, stripW: strip?.clientWidth, zoom: strip?.style.getPropertyValue('--con-cards-grid-zoom'),
          maxWidth: strip?.style.maxWidth, slot0: r(slotEls[0]), slotLast: r(slotEls[slotEls.length - 1]),
          rowSpan: Math.round(Math.max(...slots.map((b) => b.right)) - Math.min(...slots.map((b) => b.left)))}};
    });
    const g2 = await dealGeometry();
    expect(g2.rowBottom, `the tag row stands above the deal, never over it ${JSON.stringify(g2)}`).toBeLessThanOrEqual(g2.slotTop + 1);
    expect(g2.slotTop, `the deal's first row is whole under the tag row ${JSON.stringify(g2)}`).toBeGreaterThanOrEqual(g2.bodyTop - 1);
    expect(g2.slotBottom, `the deal's last row is whole above the dock ${JSON.stringify(g2)}`).toBeLessThanOrEqual(g2.bodyBottom + 1);
    // The dealt cards WITHOUT the named tag step back (a dim), the ones that carry it stand — never all, never none.
    const dimmed = await page.locator('[data-step-slot^="projects|"].con-cards__slot--dim').count();
    expect(dimmed, 'some dealt cards lack the named tag').toBeGreaterThan(0);
    expect(dimmed, 'the dim never takes the whole deal').toBeLessThan(g2.slots);
    await page.screenshot({path: 'screenshots/tenders/targeted-request-2-tag-row.png'});
    const named = await page.locator('[data-tender-mode="tag"] [data-tender-mode-picked="yes"]').getAttribute('data-tender-tag');
    await press(page, 'Period', 900);
    await expect.poll(async () => stepCards(await model(request, aliceId!), /buy|project/i).length, {timeout: 10_000, message: `three ${named} cards joined the deal`}).toBe(projectsBefore + 3);
    await expect(page.locator('[data-tender-mode="tag"]')).toHaveCount(0, {timeout: 10_000});
    await waitStepDealSettled(page);
    await expect(page.locator(`[data-step-slot^="projects|"]`)).toHaveCount(projectsBefore + 3);
    await expect(page.locator('[data-tender-dock-chip][data-tender-dock-status="executed"]')).toHaveCount(3);
    const g3 = await dealGeometry();
    expect(g3.slots).toBe(projectsBefore + 3);
    expect(g3.slotTop, `the grown deal's first row is whole in the body ${JSON.stringify(g3)}`).toBeGreaterThanOrEqual(g3.bodyTop - 1);
    expect(g3.slotBottom, `the grown deal's last row is whole above the dock ${JSON.stringify(g3)}`).toBeLessThanOrEqual(g3.bodyBottom + 1);
    expect(await page.locator('[data-step-slot^="projects|"].con-cards__slot--dim').count(), 'the dim leaves with the tag mode').toBe(0);
    await page.screenshot({path: 'screenshots/tenders/targeted-request-3-landed.png'});

    // ── «Реструктуризация»: A deals two candidates, the corporation step opens its mode by itself; A picks the candidate
    //    and the lineage corporation; RT rewrites the lineage. ──
    expect(await pressUntil(page, 'Comma', async () => /корпорац|слияни/i.test(await subject()), {tries: 4, settleMs: 900}), 'LT to the corporation step').toBe(true);
    await waitStepDealSettled(page);
    expect(await pressUntil(page, 'Comma', async () => await portfolio.isVisible(), {tries: 4, settleMs: 900}), 'LT to the portfolio').toBe(true);
    await press(page, 'ArrowRight', 250);
    await press(page, 'ArrowRight', 250);
    await expect(slot('restructuring')).toHaveAttribute('data-tport-focused', 'yes');
    await expect.poll(bar, {timeout: 5_000}).toMatch(/сдать кандидатов/i);
    await press(page, 'Enter', 900);
    await expect(page.locator('[data-tender-mode="restructure"]')).toHaveCount(1, {timeout: 15_000});
    const offer = page.locator('[data-tender-zone="offer"] [data-tender-mode-card]');
    await expect(offer).toHaveCount(2);
    await expect.poll(crumb, {timeout: 5_000}).toMatch(/реструктуризац/i);
    const take = await offer.first().getAttribute('data-tender-mode-card');
    await press(page, 'Enter', 300);
    await expect(offer.first()).toHaveAttribute('data-tender-mode-picked', 'yes');
    await press(page, 'ArrowRight', 150);
    await press(page, 'ArrowRight', 150);
    await press(page, 'Enter', 300);
    await expect(page.locator('[data-tender-zone="lineage"] [data-tender-mode-card="Ecoline"]')).toHaveAttribute('data-tender-mode-picked', 'yes');
    await press(page, 'Period', 900);
    await expect.poll(async () => (await model(request, aliceId!)).campaignLineage?.[0], {timeout: 10_000}).toBe(take);
    await expect(page.locator('[data-tender-mode="restructure"]')).toHaveCount(0);
    await expect(page.locator('[data-tender-dock-chip][data-tender-dock-status="executed"]')).toHaveCount(4);

    // ── The corporation step is the ordinary selection again: its deal lands, the pick is made. ──
    await waitStepDealSettled(page);
    // The witness is the LIVE step's pick (`pickedCards` — the hidden prelude pane already holds the kept card).
    expect(await pressUntil(page, 'Enter', async () => (await pickedCards(page)).length >= 1, {tries: 8, settleMs: 900}), 'the corporation pick landed').toBe(true);

    // ── To the summary: the preludes need two picks (the kept one is one of them); the projects stay empty. ──
    expect(await pressUntil(page, 'Period', async () => /пролог/i.test(await subject()), {tries: 4, settleMs: 900}), 'RT to the preludes').toBe(true);
    await waitStepDealSettled(page);
    // The kept card already stands picked — the driver's filler takes whatever is still unpicked up to the two.
    await fillPicks(page, 2);
    expect((await pickedCards(page)).length, 'two preludes picked on the live step').toBe(2);
    expect(await pressUntil(page, 'Period', async () => /проект/i.test(await subject()), {tries: 4, settleMs: 900}), 'RT to the projects').toBe(true);
    await waitStepDealSettled(page);
    expect(await pressUntil(page, 'Period', async () => await page.locator('.con-start__summary').isVisible(), {tries: 4, settleMs: 1200}), 'RT to the summary').toBe(true);
    await expect(page.locator('[data-summary-tenders]')).toContainText('4/5');

    // ── THE TERMINAL WARNING: «Субсидия» is still open — the first A warns, the second begins. ──
    await finishSelectionOverApi(request, brunoId!);
    await press(page, 'Enter', 700);
    await expect(page.locator('[data-start-tender-warning]')).toBeVisible();
    await expect(page.locator('[data-start-tender-warning]')).toContainText(/Субсидия/i);
    await press(page, 'Enter', 900);
    await page.waitForSelector('[data-tender-compensation]', {timeout: 60_000});
    await expect(page.locator('[data-buyout-card]')).toHaveCount(1);
    await expect(page.locator('[data-tender-compensation-sub]')).toContainText('1 × 3');

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
    expect((after.campaignTenders ?? []).filter((t) => t.status === 'executed').map((t) => t.id).sort()).toEqual(['openCall', 'preludeReview', 'restructuring', 'targetedRequest']);
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

    // ── THE OFFER DIAL (§17.3): under «Тендеры» ONE sub-row follows the mode — how many tenders a bidding deals. The
    //    default is «all but the last»; a two-seat table offers no «all but the last two», so ◄ from the default stays;
    //    ► reaches «every seat»; the sentence prints the table's numbers; the row leaves with the mode. ──
    const offer = page.locator('[data-rule-sub="tenderOffer"]');
    await expect(offer, 'the offer dial stands right under the reward mode').toHaveCount(1);
    const offerValue = offer.locator('[data-tender-offer-value]');
    await expect(offerValue).toHaveText(/кроме последнего/i);
    await expect(offer).toHaveAttribute('data-tender-offer', 'minusOne');
    await expect(offer.locator('.cm-rule__desc'), 'the sentence in the numbers of this table (two seats: two cards, one picker)').toContainText(/2.*1 из 2/);
    await press(page, 'ArrowDown', 250);
    await expect(offer, 'one step down lands on the dial').toHaveClass(/cm-row--cursor/);
    await press(page, 'ArrowLeft', 250);
    await expect(offer, 'no «all but the last two» on a two-seat table').toHaveAttribute('data-tender-offer', 'minusOne');
    await press(page, 'ArrowRight', 250);
    await expect(offerValue).toHaveText(/Каждому месту/i);
    await expect(offer).toHaveAttribute('data-tender-offer', 'all');
    await expect(offer.locator('.cm-rule__desc')).toContainText(/2 из 2/);
    await press(page, 'ArrowUp', 250);
    await press(page, 'Enter', 250);
    await expect(value, 'A on the mode cycles it back to titles').toHaveText(/Титулы/i);
    await expect(offer, 'the dial leaves with the mode').toHaveCount(0);
    await press(page, 'Enter', 250);
    await expect(value).toHaveText(/Тендеры/i);
    await expect(offer, 'and returns with it, its value kept').toHaveAttribute('data-tender-offer', 'all');
  });
});
